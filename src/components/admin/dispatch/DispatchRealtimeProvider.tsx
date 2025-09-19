import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface DispatchUpdate {
  id: string;
  order_id: string;
  status: string;
  order_number?: string;
  client_name?: string;
}

interface DispatchRealtimeContextType {
  isConnected: boolean;
  recentUpdates: DispatchUpdate[];
  enableRealtime: () => void;
  disableRealtime: () => void;
}

const DispatchRealtimeContext = createContext<DispatchRealtimeContextType | null>(null);

export function DispatchRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [recentUpdates, setRecentUpdates] = useState<DispatchUpdate[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const enableRealtime = useCallback(() => {
    if (isConnected || channelRef.current) return;

    console.log('🔌 Enabling real-time updates...');
    
    const channel = supabase
      .channel('charger_dispatches_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'charger_dispatches'
        },
        async (payload) => {
          console.log('📦 Dispatch update received:', payload);

          // Get additional order details for the notification
          const orderId = (payload.new as any)?.order_id || (payload.old as any)?.order_id;
          const { data: orderData } = await supabase
            .from('orders')
            .select(`
              order_number,
              clients!inner (
                full_name
              )
            `)
            .eq('id', orderId)
            .single();

          const update: DispatchUpdate = {
            id: (payload.new as any)?.id || (payload.old as any)?.id,
            order_id: orderId,
            status: (payload.new as any)?.status || 'deleted',
            order_number: orderData?.order_number,
            client_name: orderData?.clients?.full_name
          };

          setRecentUpdates(prev => [update, ...prev.slice(0, 9)]);

          // Show toast notification with correct status mapping
          const getStatusMessage = (status: string, eventType: string) => {
            if (eventType === 'DELETE') return 'Dispatch record removed';
            switch (status) {
              case 'sent': return 'Charger dispatched';
              case 'delivered': return 'Charger delivered';
              case 'issue': return 'Dispatch issue flagged';
              default: return 'Dispatch status updated';
            }
          };

          toast({
            title: "Dispatch Update",
            description: `${getStatusMessage(update.status, payload.eventType)} for ${update.order_number} (${update.client_name})`,
            duration: 4000,
          });

          // Invalidate relevant queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['charger-dispatch-data'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Channel status:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          toast({
            title: "Real-time Updates Enabled",
            description: "You'll receive live dispatch notifications",
            duration: 2000,
          });
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;
  }, [isConnected, toast, queryClient]);

  const disableRealtime = useCallback(() => {
    console.log('🔌 Disabling real-time updates...');
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    setIsConnected(false);
    toast({
      title: "Real-time Updates Disabled",
      description: "Live notifications turned off",
      duration: 2000,
    });
  }, [toast]);

  return (
    <DispatchRealtimeContext.Provider
      value={{
        isConnected,
        recentUpdates,
        enableRealtime,
        disableRealtime
      }}
    >
      {children}
    </DispatchRealtimeContext.Provider>
  );
}

export function useDispatchRealtime() {
  const context = useContext(DispatchRealtimeContext);
  if (!context) {
    throw new Error('useDispatchRealtime must be used within DispatchRealtimeProvider');
  }
  return context;
}