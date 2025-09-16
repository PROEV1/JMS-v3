import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { useServerPagination } from '@/hooks/useServerPagination';
import { keepPreviousData } from '@tanstack/react-query';
import { FixOrderStatusButton } from '../admin/FixOrderStatusButton';

export function DateOfferedListPage() {
  const { pagination, controls } = useServerPagination();

  const { data: ordersResponse = { data: [], count: 0 }, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'date-offered-optimized', pagination.page, pagination.pageSize],
    queryFn: async () => {
      const startTime = performance.now();
      console.log('DateOfferedListPage: Using optimized RPC for date offered orders...');
      
      const { data: ordersData, error } = await supabase.rpc('get_date_offered_orders', {
        p_limit: pagination.pageSize,
        p_offset: pagination.offset
      });

      if (error) {
        console.error('DateOfferedListPage: Error fetching date offered orders:', error);
        throw error;
      }

      // Transform RPC result to match expected format
      const transformedOrders = ordersData?.map(order => ({
        id: order.id,
        order_number: order.order_number,
        client_id: order.client_id,
        engineer_id: order.engineer_id,
        scheduled_install_date: order.scheduled_install_date,
        status_enhanced: order.status_enhanced,
        created_at: order.created_at,
        estimated_duration_hours: order.estimated_duration_hours,
        job_type: order.job_type as 'installation' | 'assessment' | 'service_call' | string,
        status: 'pending', // Add required status field
        client: order.client_full_name ? {
          full_name: order.client_full_name,
          email: order.client_email,
          phone: order.client_phone,
          postcode: order.client_postcode,
          address: order.client_address
        } : null,
        engineer: order.engineer_name ? {
          name: order.engineer_name,
          email: null,
          region: null
        } : null,
        partner: order.partner_name ? {
          name: order.partner_name
        } : null,
        job_offers: [{
          id: order.offer_id,
          expires_at: order.offer_expires_at,
          offered_date: order.offer_offered_date
        }]
      })) || [];

      const endTime = performance.now();
      console.log(`DateOfferedListPage: Loaded ${transformedOrders.length} orders in ${(endTime - startTime).toFixed(2)}ms`);
      
      // For pagination, we'll need to get total count separately or estimate
      // For now, using the current result length as estimate
      return { data: transformedOrders, count: transformedOrders.length };
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
        .select('id, name, email, availability') // Include availability for type compatibility
        .eq('availability', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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
      <ScheduleStatusNavigation currentStatus="date-offered" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Date Offered ({totalCount})
            </div>
            <FixOrderStatusButton orderId="5b609a0e-8036-48df-89ff-9a545cddec66" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Date Offered"
            showAutoSchedule={false}
            pagination={pagination}
            totalCount={totalCount}
            onPageChange={controls.setPage}
            onPageSizeChange={controls.setPageSize}
            exportQueryBuilder={async () => {
              // For export, use the same direct query logic
              const { data, error } = await supabase
                .from('orders')
                .select(`
                  *,
                  client:client_id(full_name, email, phone, postcode, address),
                  engineer:engineer_id(name, email, region),
                  partner:partner_id(name),
                  quote:quote_id(quote_number),
                  job_offers!inner(id, status, offered_date, expires_at)
                `)
                .eq('job_offers.status', 'pending')
                .gt('job_offers.expires_at', new Date().toISOString())
                .is('scheduled_install_date', null)
                .order('job_offers.created_at', { ascending: false });
              
              if (error) throw error;
              return data || [];
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}