import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { useServerPagination } from '@/hooks/useServerPagination';
import { keepPreviousData } from '@tanstack/react-query';

export function ReadyToBookListPage() {
  const { pagination, controls } = useServerPagination();

  const { data: ordersResponse = { data: [], count: 0 }, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'ready-to-book', pagination.page, pagination.pageSize],
    queryFn: async () => {
      // First get accepted offers
      const { data: acceptedOffers, error: offersError } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'accepted');

      if (offersError) throw offersError;
      
      if (!acceptedOffers?.length) return { data: [], count: 0 };

      const uniqueOrderIds = [...new Set(acceptedOffers.map(offer => offer.order_id))];
      
      // Fetch orders with accepted offers that haven't been scheduled yet
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name)
        `, { count: 'exact' })
        .in('id', uniqueOrderIds)
        .eq('status_enhanced', 'awaiting_install_booking')
        .is('scheduled_install_date', null)
        .eq('scheduling_suppressed', false)
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
          />
        </CardContent>
      </Card>
    </div>
  );
}