import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle } from 'lucide-react';
import { useServerPagination } from '@/hooks/useServerPagination';
import { keepPreviousData } from '@tanstack/react-query';

export function DateRejectedListPage() {
  const { pagination, controls } = useServerPagination();

  const { data: ordersResponse = { data: [], count: 0 }, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'date-rejected', pagination.page, pagination.pageSize],
    queryFn: async () => {
      // Get rejected offers
      const { data: rejectedOffers, error: rejectedError } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'rejected');

      if (rejectedError) throw rejectedError;
      
      if (!rejectedOffers?.length) return { data: [], count: 0 };

      // Get active offers to exclude orders that have them
      const { data: activeOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .in('status', ['pending', 'accepted'])
        .gt('expires_at', new Date().toISOString());

      const ordersWithActiveOffers = new Set(activeOffers?.map(offer => offer.order_id) || []);
      const uniqueRejectedOrderIds = [...new Set(rejectedOffers.map(offer => offer.order_id))]
        .filter(orderId => !ordersWithActiveOffers.has(orderId));

      if (!uniqueRejectedOrderIds.length) return { data: [], count: 0 };

      // Fetch orders with pagination
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name)
        `, { count: 'exact' })
        .in('id', uniqueRejectedOrderIds)
        .order('created_at', { ascending: false });

      query = query.range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      
      return { data: data || [], count: count || 0 };
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

  if (ordersLoading || engineersLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScheduleStatusNavigation currentStatus="date-rejected" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Date Rejected ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Date Rejected"
            showAutoSchedule={true}
            pagination={pagination}
            totalCount={totalCount}
            onPageChange={controls.setPage}
            onPageSizeChange={controls.setPageSize}
            exportQueryBuilder={async () => {
              // Get rejected offers
              const { data: rejectedOffers, error: rejectedError } = await supabase
                .from('job_offers')
                .select('order_id')
                .eq('status', 'rejected');

              if (rejectedError) throw rejectedError;
              
              if (!rejectedOffers?.length) return [];

              // Get active offers to exclude orders that have them
              const { data: activeOffers } = await supabase
                .from('job_offers')
                .select('order_id')
                .in('status', ['pending', 'accepted'])
                .gt('expires_at', new Date().toISOString());

              const ordersWithActiveOffers = new Set(activeOffers?.map(offer => offer.order_id) || []);
              const uniqueRejectedOrderIds = [...new Set(rejectedOffers.map(offer => offer.order_id))]
                .filter(orderId => !ordersWithActiveOffers.has(orderId));

              if (!uniqueRejectedOrderIds.length) return [];

              const { data, error } = await supabase
                .from('orders')
                .select(`
                  *,
                  client:client_id(full_name, email, phone, postcode, address),
                  engineer:engineer_id(name, email, region),
                  partner:partner_id(name),
                  quote:quote_id(quote_number)
                `)
                .in('id', uniqueRejectedOrderIds)
                .order('created_at', { ascending: false });
              
              if (error) throw error;
              return data || [];
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}