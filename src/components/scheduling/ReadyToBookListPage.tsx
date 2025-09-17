import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { useServerPagination } from '@/hooks/useServerPagination';
import { keepPreviousData } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';

export function ReadyToBookListPage() {
  const { pagination, controls } = useServerPagination();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Build search query with enhanced search across related tables  
  const buildSearchQuery = useMemo(() => {
    return async (withPagination = true, withCount = true) => {
      // Fetch orders that are ready to book - either have accepted offers OR status is date_accepted
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name),
          quote:quote_id(quote_number)
        `, withCount ? { count: 'exact' } : {})
        .eq('status_enhanced', 'date_accepted')  // Show orders with date_accepted status
        .is('scheduled_install_date', null)  // But not yet scheduled
        .eq('scheduling_suppressed', false)
        .order('created_at', { ascending: false });

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

      // Execute the query and return the result
      const { data, error, count } = await query;
      if (error) throw error;
      
      return { data: data || [], count: count || 0 };
    };
  }, [debouncedSearchTerm, pagination.offset, pagination.pageSize]);

  const { data: ordersResponse = { data: [], count: 0 }, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', 'ready-to-book', pagination.page, pagination.pageSize, debouncedSearchTerm],
    queryFn: async () => {
      try {
        const result = await buildSearchQuery(true, true);
        
        // Transform data
        const transformedData = result.data?.map(order => ({
          ...order,
          client: order.client || null,
          quote: order.quote || null,
          engineer: order.engineer || null,
          partner: order.partner || null
        })) || [];

        return { data: transformedData, count: result.count || 0 };
      } catch (error) {
        console.error('Orders query error:', error);
        throw error;
      }
    },
    placeholderData: keepPreviousData,
  });

  const orders = ordersResponse?.data || [];
  const totalCount = ordersResponse?.count || 0;

  const { data: engineers = [], isLoading: engineersLoading } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('availability', true)
        .order('name');

      if (error) throw error;
      return data || [];
    }
  });

  // Listen for scheduling refresh events and real-time updates
  useEffect(() => {
    const handleRefresh = () => {
      console.log('ReadyToBookListPage: Received refresh event, refetching data...');
      refetchOrders();
    };
    
    // Listen for custom refresh events
    window.addEventListener('scheduling:refresh', handleRefresh);
    
    // Set up real-time subscriptions for orders and job_offers
    const ordersChannel = supabase
      .channel('ready-to-book-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          console.log('ReadyToBookListPage: Orders real-time update received');
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
        () => {
          console.log('ReadyToBookListPage: Job offers real-time update received');
          refetchOrders();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('scheduling:refresh', handleRefresh);
      supabase.removeChannel(ordersChannel);
    };
  }, [refetchOrders]);

  if (ordersLoading || engineersLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScheduleStatusNavigation currentStatus="ready-to-book" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Ready to Book ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Ready to Book"
            showAutoSchedule={true}
            pagination={pagination}
            totalCount={totalCount}
            onPageChange={controls.setPage}
            onPageSizeChange={controls.setPageSize}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onUpdate={() => {
              console.log('ReadyToBookListPage: Manual update requested, refetching...');
              refetchOrders();
            }}
            exportQueryBuilder={async () => {
              const result = await buildSearchQuery(false, false);
              return result.data || [];
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}