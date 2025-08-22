
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { EnhancedJobCard } from './EnhancedJobCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';

export function NotInSchedulingListPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', 'not-in-scheduling'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          clients:client_id(full_name, email, phone),
          engineers:engineer_id(name, email),
          partners:partner_id(name)
        `)
        .eq('scheduling_suppressed', true)
        .neq('status_enhanced', 'cancelled')
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
      <ScheduleStatusNavigation currentStatus="not-in-scheduling" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Not in Scheduling Pipeline ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No jobs excluded from scheduling</p>
              </div>
            ) : (
              orders.map((order) => (
                <EnhancedJobCard
                  key={order.id}
                  order={{
                    ...order,
                    clients: order.clients ? {
                      name: order.clients.full_name,
                      email: order.clients.email,
                      phone: order.clients.phone
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
