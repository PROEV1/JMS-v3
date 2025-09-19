import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Search, Check, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleStatusListPage } from './ScheduleStatusListPage';
import { ScheduleStatusNavigation } from './ScheduleStatusNavigation';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AwaitingPartsOrderListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', 'awaiting-parts-order'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:client_id(full_name, email, phone, postcode, address),
          engineer:engineers!engineer_id(name, email, region),
          partner:partner_id(name),
          quote:quote_id(quote_number)
        `)
        .eq('status_enhanced', 'awaiting_parts_order')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  const handleMarkPartsOrdered = async (orderIds: string[]) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          parts_ordered: true,
          updated_at: new Date().toISOString()
        })
        .in('id', orderIds);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Marked parts as ordered for ${orderIds.length} order(s)`,
      });

      setSelectedOrders([]);
      refetch();
    } catch (error) {
      console.error('Error marking parts as ordered:', error);
      toast({
        title: "Error",
        description: "Failed to mark parts as ordered",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <ScheduleStatusNavigation currentStatus="awaiting-parts-order" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Awaiting Parts Order</h1>
          <Badge variant="outline" className="ml-2">
            {orders.length}
          </Badge>
        </div>
        
        {selectedOrders.length > 0 && (
          <Button
            onClick={() => handleMarkPartsOrdered(selectedOrders)}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Mark Parts Ordered ({selectedOrders.length})
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Jobs Requiring Parts</CardTitle>
          <p className="text-sm text-muted-foreground">
            These orders need parts to be ordered before they can proceed to scheduling. 
            Standard quotes go here immediately, custom quotes wait for partner confirmation.
          </p>
        </CardHeader>
        <CardContent>
          <ScheduleStatusListPage 
            orders={orders}
            engineers={engineers}
            title="Awaiting Parts Order"
            showAutoSchedule={false}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onUpdate={refetch}
          />
        </CardContent>
      </Card>
    </div>
  );
}