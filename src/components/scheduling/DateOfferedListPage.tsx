import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { EnhancedJobCard } from './EnhancedJobCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export function DateOfferedListPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', 'date-offered'],
    queryFn: async () => {
      // Get orders with active pending offers
      const { data: pendingOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (!pendingOffers?.length) return [];

      const uniqueOrderIds = [...new Set(pendingOffers.map(offer => offer.order_id))];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name)
        `)
        .in('id', uniqueOrderIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  if (isLoading) {
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
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Offered ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No jobs with pending offers</p>
              </div>
            ) : (
              orders.map((order) => (
                <EnhancedJobCard
                  key={order.id}
                  order={{
                    ...order,
                    clients: order.client ? {
                      name: order.client.full_name,
                      email: order.client.email,
                      phone: order.client.phone
                    } : undefined
                  }}
                  onUpdate={() => {
                    // Refresh the data
                  }}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}