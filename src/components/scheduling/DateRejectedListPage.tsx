import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

export function DateRejectedListPage() {
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'date-rejected'],
    queryFn: async () => {
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

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name)
        `)
        .in('id', uniqueRejectedOrderIds)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
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
            Date Rejected ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Date Rejected"
            showAutoSchedule={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}