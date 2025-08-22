import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export function NeedsSchedulingListPage() {
  console.log('NeedsSchedulingListPage: Starting component render');
  
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ['orders', 'needs-scheduling'],
    queryFn: async () => {
      console.log('NeedsSchedulingListPage: Fetching orders...');
      // First get orders that need scheduling (matching the count calculation)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name)
        `)
        .eq('status_enhanced', 'awaiting_install_booking')
        .is('engineer_id', null)
        .eq('scheduling_suppressed', false)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('NeedsSchedulingListPage: Error fetching orders:', ordersError);
        throw ordersError;
      }
      
      console.log('NeedsSchedulingListPage: Got orders:', ordersData?.length);
      
      if (!ordersData?.length) return [];

      // Get active offers to exclude orders that have them
      const { data: activeOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      const ordersWithActiveOffers = new Set(activeOffers?.map(offer => offer.order_id) || []);
      
      // Filter out orders that have active offers
      const filteredOrders = ordersData.filter(order => !ordersWithActiveOffers.has(order.id));
      console.log('NeedsSchedulingListPage: Filtered orders:', filteredOrders.length);
      return filteredOrders;
    }
  });

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
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Needs Scheduling ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Needs Scheduling"
            showAutoSchedule={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}