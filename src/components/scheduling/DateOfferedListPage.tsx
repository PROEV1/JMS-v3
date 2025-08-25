import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export function DateOfferedListPage() {
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'date-offered'],
    queryFn: async () => {
      // Query orders directly based on status_enhanced to ensure consistency
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineer_id(name, email, region),
          partner:partner_id(name)
        `)
        .eq('status_enhanced', 'date_offered')
        .eq('scheduling_suppressed', false)
        .is('scheduled_install_date', null) // Extra safeguard to ensure not scheduled
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
      <ScheduleStatusNavigation currentStatus="date-offered" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Date Offered ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Date Offered"
            showAutoSchedule={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}