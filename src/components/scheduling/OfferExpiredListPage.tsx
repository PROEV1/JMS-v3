import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export function OfferExpiredListPage() {
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'offer-expired'],
    queryFn: async () => {
      // Get expired offers
      const { data: expiredOffers, error: expiredError } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'expired');

      if (expiredError) throw expiredError;
      
      if (!expiredOffers?.length) return [];

      const uniqueOrderIds = [...new Set(expiredOffers.map(offer => offer.order_id))];

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name)
        `)
        .in('id', uniqueOrderIds)
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
      <ScheduleStatusNavigation currentStatus="offer-expired" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Offer Expired ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Offer Expired"
            showAutoSchedule={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}