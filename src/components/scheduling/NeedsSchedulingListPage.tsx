import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { buildSafeUuidInClause } from '@/utils/schedulingUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, UserCheck } from 'lucide-react';
import { useServerPagination } from '@/hooks/useServerPagination';
import { keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';

export function NeedsSchedulingListPage() {
  console.log('NeedsSchedulingListPage: Starting component render');
  const queryClient = useQueryClient();
  const { pagination, controls } = useServerPagination();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  // Always include assigned engineers - no toggle needed

  // Build search query with enhanced search across related tables
  const buildSearchQuery = useMemo(() => {
    return async (withPagination = true, withCount = true) => {
      console.log('NeedsSchedulingListPage: Building search query...');
      
      // First get all active offers to exclude orders with them
      const { data: activeOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      const activeOfferOrderIds = activeOffers?.map(offer => offer.order_id) || [];

      // Base query for orders that need scheduling (excluding those with active offers)
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name),
          quote:quote_id(quote_number)
        `, withCount ? { count: 'exact' } : {})
        .eq('status_enhanced', 'awaiting_install_booking')
        .eq('scheduling_suppressed', false)
        .order('created_at', { ascending: false });

      // Exclude orders with active offers
      if (activeOfferOrderIds.length > 0) {
        const safeIds = buildSafeUuidInClause(activeOfferOrderIds);
        if (safeIds) {
          query = query.not('id', 'in', `(${safeIds})`);
        }
      }

      // Apply search filter across all relevant tables
      if (debouncedSearchTerm) {
        const searchPattern = `%${debouncedSearchTerm}%`;
        
        // Find matching client and quote IDs for this search
        const [matchingClients, matchingQuotes] = await Promise.all([
          supabase.from('clients').select('id')
            .or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern}`),
          supabase.from('quotes').select('id')
            .ilike('quote_number', searchPattern)
        ]);
        
        const clientIds = matchingClients.data?.map(c => c.id) || [];
        const quoteIds = matchingQuotes.data?.map(q => q.id) || [];

        const searchConditions = [
          `order_number.ilike.${searchPattern}`,
          `partner_external_url.ilike.${searchPattern}`,
          `job_address.ilike.${searchPattern}`,
          `postcode.ilike.${searchPattern}`
        ];

        if (clientIds.length > 0) {
          searchConditions.push(`client_id.in.(${clientIds.join(',')})`);
        }
        if (quoteIds.length > 0) {
          searchConditions.push(`quote_id.in.(${quoteIds.join(',')})`);
        }

        query = query.or(searchConditions.join(','));
      }

      // Apply pagination if requested
      if (withPagination) {
        query = query.range(pagination.offset, pagination.offset + pagination.pageSize - 1);
      }

      return query;
    };
  }, [debouncedSearchTerm, pagination.offset, pagination.pageSize]);
  
  const { data: ordersResponse = { data: [], count: 0, unassignedCount: 0, assignedCount: 0 }, isLoading: ordersLoading, error: ordersError, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', 'needs-scheduling', pagination.page, pagination.pageSize, debouncedSearchTerm],
    queryFn: async () => {
      try {
        const query = await buildSearchQuery(true, true);
        const { data: ordersData, error: ordersError, count: totalCount } = await query;
        
        if (ordersError) {
          console.error('NeedsSchedulingListPage: Error fetching orders:', ordersError);
          throw ordersError;
        }
        
        console.log('NeedsSchedulingListPage: Got orders:', ordersData?.length);
        
        if (!ordersData?.length) return { data: [], count: totalCount || 0, unassignedCount: 0, assignedCount: 0 };
        
        // Transform data
        const transformedData = ordersData?.map(order => ({
          ...order,
          client: order.client || null,
          quote: order.quote || null,
          engineer: order.engineer || null,
          partner: order.partner || null
        })) || [];
        
        // Get counts for assigned vs unassigned from the paginated results
        const unassignedCount = transformedData.filter(order => !order.engineer_id).length;
        const assignedCount = transformedData.filter(order => order.engineer_id).length;
        
        return { 
          data: transformedData, 
          count: totalCount || 0,
          unassignedCount,
          assignedCount
        };
      } catch (error) {
        console.error('NeedsSchedulingListPage query error:', error);
        throw error;
      }
    },
    placeholderData: keepPreviousData,
  });

  const orders = ordersResponse?.data || [];
  const totalCount = ordersResponse?.count || 0;
  const unassignedCount = ordersResponse?.unassignedCount || 0;
  const assignedCount = ordersResponse?.assignedCount || 0;

  const { data: engineers = [], isLoading: engineersLoading, error: engineersError } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      console.log('NeedsSchedulingListPage: Fetching engineers...');
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('availability', true)
        .order('name');

      if (error) {
        console.error('NeedsSchedulingListPage: Error fetching engineers:', error);
        throw error;
      }
      console.log('NeedsSchedulingListPage: Got engineers:', data?.length);
      return data || [];
    }
  });

  // Listen for scheduling refresh events and real-time updates
  useEffect(() => {
    const handleRefresh = () => {
      console.log('NeedsSchedulingListPage: Received refresh event, refetching data...');
      refetchOrders();
    };
    
    // Listen for custom refresh events
    window.addEventListener('scheduling:refresh', handleRefresh);
    
    // Set up real-time subscriptions for orders and job_offers
    const ordersChannel = supabase
      .channel('needs-scheduling-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('NeedsSchedulingListPage: Orders real-time update:', payload);
          refetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_offers'
        },
        (payload) => {
          console.log('NeedsSchedulingListPage: Job offers real-time update:', payload);
          refetchOrders();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('scheduling:refresh', handleRefresh);
      supabase.removeChannel(ordersChannel);
    };
  }, [refetchOrders]);

  console.log('NeedsSchedulingListPage - Orders count:', orders?.length, 'Engineers count:', engineers?.length);
  
  // Show errors if any
  if (ordersError || engineersError) {
    console.error('NeedsSchedulingListPage: Errors occurred:', { ordersError, engineersError });
    return (
      <div className="space-y-6">
        <ScheduleStatusNavigation currentStatus="needs-scheduling" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Calendar className="h-5 w-5" />
              Needs Scheduling - Error Loading Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-600">
              <p>Error loading data:</p>
              {ordersError && <p>Orders: {ordersError.message}</p>}
              {engineersError && <p>Engineers: {engineersError.message}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (ordersLoading || engineersLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScheduleStatusNavigation currentStatus="needs-scheduling" />
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Needs Scheduling ({totalCount})
              <div className="flex items-center gap-2 ml-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Unassigned: {unassignedCount}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  Assigned: {assignedCount}
                </Badge>
              </div>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Needs Scheduling"
            showAutoSchedule={true}
            pagination={pagination}
            totalCount={totalCount}
            onPageChange={controls.setPage}
            onPageSizeChange={controls.setPageSize}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onUpdate={() => {
              console.log('NeedsSchedulingListPage: Manual update requested, refetching...');
              refetchOrders();
            }}
            exportQueryBuilder={async () => {
              const query = await buildSearchQuery(false, false);
              const { data, error } = await query;
              if (error) throw error;
              return data || [];
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}