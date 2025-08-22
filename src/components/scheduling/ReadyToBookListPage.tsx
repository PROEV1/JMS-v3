import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { EnhancedJobCard } from './EnhancedJobCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export function ReadyToBookListPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', 'ready-to-book'],
    queryFn: async () => {
      // Get orders with accepted offers that haven't been scheduled yet
      const { data: acceptedOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'accepted');

      if (!acceptedOffers?.length) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name)
        `)
        .eq('status_enhanced', 'awaiting_install_booking')
        .is('scheduled_install_date', null)
        .eq('scheduling_suppressed', false)
        .in('id', acceptedOffers.map(offer => offer.order_id))
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
      <ScheduleStatusNavigation currentStatus="ready-to-book" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Ready to Book ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No jobs ready to book</p>
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