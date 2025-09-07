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
    queryKey: ['orders', 'date-offered', pagination.page, pagination.pageSize],
    queryFn: async () => {
      console.log('DateOfferedListPage: Querying for orders with active pending offers...');
      
      // SIMPLIFIED: Just query for orders with active pending offers directly
      // This matches the navigation count logic exactly
      const query = supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name),
          job_offers!inner(id, status, offered_date, expires_at, created_at)
        `, { count: 'exact' })
        .eq('job_offers.status', 'pending')
        .gt('job_offers.expires_at', new Date().toISOString())
        .is('scheduled_install_date', null)
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1)
        .order('job_offers.created_at', { ascending: false });

      const { data, error, count } = await query;
      if (error) {
        console.error('DateOfferedListPage query error:', error);
        throw error;
      }
      
      console.log('DateOfferedListPage: Found orders with pending offers:', data?.length || 0, 'Total count:', count);
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