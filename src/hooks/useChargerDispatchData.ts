import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { keepPreviousData } from '@tanstack/react-query';

interface DispatchFilters {
  dateFrom: string;
  dateTo: string;
  region: string;
  engineer: string;
  dispatchStatus: string;
  jobType: string;
}

interface PaginationState {
  page: number;
  pageSize: number;
  offset: number;
}

export function useChargerDispatchData({
  pagination,
  filters
}: {
  pagination: PaginationState;
  filters: DispatchFilters;
}) {
  return useQuery({
    queryKey: ['charger-dispatch-data', pagination, filters],
    queryFn: async () => {
      // First, get ALL matching records for stats calculation (without pagination)
      let statsQuery = supabase
        .from('orders')
        .select(`
          id,
          job_type,
          scheduled_install_date,
          charger_dispatches (
            status,
            dispatched_at
          )
        `)
        .not('scheduled_install_date', 'is', null);

      // Apply filters to stats query
      if (filters.dateFrom) {
        statsQuery = statsQuery.gte('scheduled_install_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        statsQuery = statsQuery.lte('scheduled_install_date', filters.dateTo);
      }
      if (filters.engineer !== 'all') {
        statsQuery = statsQuery.eq('engineer_id', filters.engineer);
      }

      const { data: allOrders, error: statsError, count } = await statsQuery;
      if (statsError) throw statsError;

      // Calculate stats from ALL records
      const stats = {
        pendingDispatch: 0,
        dispatched: 0,
        urgent: 0,
        issues: 0
      };

      allOrders?.forEach(order => {
        const dispatchRecord = order.charger_dispatches?.[0];
        const installDate = new Date(order.scheduled_install_date);
        const daysUntilInstall = Math.ceil((installDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        // Determine dispatch status
        let dispatchStatus = 'pending_dispatch';
        if (order.job_type === 'service_call') {
          dispatchStatus = 'not_required';
        } else if (dispatchRecord && dispatchRecord.status) {
          dispatchStatus = dispatchRecord.status;
        } else if (dispatchRecord && !dispatchRecord.status) {
          // Has dispatch record but no status means it's pending
          dispatchStatus = 'pending_dispatch';
        }

        // Calculate urgency
        let urgencyLevel = 'normal';
        if (daysUntilInstall <= 2 && dispatchStatus === 'pending_dispatch') {
          urgencyLevel = 'urgent';
        }

        // Update stats
        if (dispatchStatus === 'pending_dispatch') stats.pendingDispatch++;
        if (dispatchStatus === 'sent') stats.dispatched++;
        if (urgencyLevel === 'urgent') stats.urgent++;
        if (dispatchStatus === 'issue') stats.issues++;
      });

      // Now get paginated data for the table
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          scheduled_install_date,
          status_enhanced,
          created_at,
          job_type,
          clients!inner (
            id,
            full_name,
            postcode,
            address,
            phone
          ),
          engineers (
            id,
            name,
            region
          ),
          charger_dispatches (
            id,
            status,
            dispatched_at,
            delivered_at,
            tracking_number,
            notes,
            created_at,
            dispatched_by
          )
        `)
        .not('scheduled_install_date', 'is', null)
        .order('scheduled_install_date', { ascending: true });

      // Apply filters to paginated query
      if (filters.dateFrom) {
        ordersQuery = ordersQuery.gte('scheduled_install_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        ordersQuery = ordersQuery.lte('scheduled_install_date', filters.dateTo);
      }
      if (filters.engineer !== 'all') {
        ordersQuery = ordersQuery.eq('engineer_id', filters.engineer);
      }

      if (filters.dispatchStatus !== 'all') {
        switch (filters.dispatchStatus) {
          case 'not_required':
            ordersQuery = ordersQuery.eq('job_type', 'service_call');
            break;
          case 'pending_dispatch':
            // Include orders with no dispatch record OR dispatch record with null/pending status
            ordersQuery = ordersQuery.or('charger_dispatches.is.null,charger_dispatches.status.is.null,charger_dispatches.status.eq.pending_dispatch');
            break;
          case 'dispatched':
            ordersQuery = ordersQuery.not('charger_dispatches', 'is', null)
              .eq('charger_dispatches.status', 'sent');
            break;
          case 'issue':
            ordersQuery = ordersQuery.not('charger_dispatches', 'is', null)
              .eq('charger_dispatches.status', 'issue');
            break;
        }
      }

      // Get actual data with pagination
      const { data: orders, error } = await ordersQuery
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) throw error;

      // Calculate dispatch status and urgency for each order
      const enrichedOrders = await Promise.all(orders.map(async order => {
        const dispatchRecord = order.charger_dispatches?.[0];
        const installDate = new Date(order.scheduled_install_date);
        const daysUntilInstall = Math.ceil((installDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        // Determine dispatch status
        let dispatchStatus = 'pending_dispatch';
        if (order.job_type === 'service_call') {
          dispatchStatus = 'not_required';
        } else if (dispatchRecord && dispatchRecord.status) {
          dispatchStatus = dispatchRecord.status;
        } else if (dispatchRecord && !dispatchRecord.status) {
          // Has dispatch record but no status means it's pending
          dispatchStatus = 'pending_dispatch';
        }

        // Calculate urgency
        let urgencyLevel = 'normal';
        if (daysUntilInstall <= 2 && dispatchStatus === 'pending_dispatch') {
          urgencyLevel = 'urgent';
        } else if (daysUntilInstall <= 5 && dispatchStatus === 'pending_dispatch') {
          urgencyLevel = 'warning';
        } else if (dispatchStatus === 'sent' || dispatchStatus === 'delivered') {
          urgencyLevel = 'success';
        }

        // Get dispatched by user profile if available
        let dispatchedByName = null;
        if (dispatchRecord?.dispatched_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', dispatchRecord.dispatched_by)
            .single();
          dispatchedByName = profile?.full_name || null;
        }

        return {
          ...order,
          dispatch_status: dispatchStatus,
          urgency_level: urgencyLevel,
          days_until_install: daysUntilInstall,
          dispatch_record: dispatchRecord ? {
            ...dispatchRecord,
            dispatched_by_name: dispatchedByName
          } : null
        };
      }));

      return {
        orders: enrichedOrders,
        totalCount: count || 0,
        stats
      };
    },
    placeholderData: keepPreviousData
  });
}

// Hook to get engineers for filter dropdown
export function useEngineersForDispatch() {
  return useQuery({
    queryKey: ['engineers-dispatch-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name, region')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    }
  });
}