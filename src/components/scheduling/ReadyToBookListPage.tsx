import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export function ReadyToBookListPage() {
  const queryClient = useQueryClient();
  
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', 'ready-to-book'],
    queryFn: async () => {
      console.log('Fetching ready-to-book orders...');
      // First get accepted offers
      const { data: acceptedOffers, error: offersError } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'accepted');

      if (offersError) throw offersError;
      
      if (!acceptedOffers?.length) {
        console.log('No accepted offers found');
        return [];
      }

      const uniqueOrderIds = [...new Set(acceptedOffers.map(offer => offer.order_id))];
      console.log('Found accepted offers for orders:', uniqueOrderIds);
      
      // Fetch orders with accepted offers that haven't been scheduled yet
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name)
        `)
        .in('id', uniqueOrderIds)
        .eq('status_enhanced', 'awaiting_install_booking')
        .is('scheduled_install_date', null)
        .eq('scheduling_suppressed', false)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      console.log('Ready-to-book orders fetched:', ordersData?.length || 0);
      return ordersData || [];
    }
  });

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

  const handleUpdate = async () => {
    console.log('Update triggered - invalidating queries...');
    // Invalidate both orders and offers queries to ensure fresh data
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['orders', 'ready-to-book'] }),
      queryClient.invalidateQueries({ queryKey: ['job-offers'] }),
      refetchOrders()
    ]);
    console.log('Queries invalidated and refetched');
  };

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
            Ready to Book ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Ready to Book"
            showAutoSchedule={true}
            onUpdate={handleUpdate}
          />
        </CardContent>
      </Card>
    </div>
  );
}