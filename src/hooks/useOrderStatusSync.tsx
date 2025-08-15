import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useOrderStatusSync(orderId: string) {
  const { toast } = useToast();
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    // Set up real-time subscription for order changes
    const channel = supabase
      .channel('order-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        async (payload) => {
          const newOrder = payload.new as any;
          const oldOrder = payload.old as any;
          
          // Check if status changed
          if (newOrder.status_enhanced !== oldOrder.status_enhanced) {
            setLastStatus(newOrder.status_enhanced);
            
            // Trigger email notification
            await triggerStatusEmail(newOrder);
            
            // Show toast notification
            toast({
              title: "Order Status Updated",
              description: `Status changed to: ${newOrder.status_enhanced.replace('_', ' ')}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, toast]);

  const triggerStatusEmail = async (order: any) => {
    try {
      // Get client details for email
      const { data: client } = await supabase
        .from('clients')
        .select('full_name, email')
        .eq('id', order.client_id)
        .single();

      if (!client) return;

      // Get engineer details if assigned
      let engineerName = null;
      if (order.engineer_id) {
        const { data: engineer } = await supabase
          .from('engineers')
          .select('name')
          .eq('id', order.engineer_id)
          .single();
        engineerName = engineer?.name;
      }

      // Send email notification
      await supabase.functions.invoke('send-order-status-email', {
        body: {
          orderId: order.id,
          status: order.status_enhanced,
          clientEmail: client.email,
          clientName: client.full_name,
          orderNumber: order.order_number,
          installDate: order.scheduled_install_date,
          engineerName
        }
      });
    } catch (error) {
      console.error('Error sending status email:', error);
    }
  };

  return { lastStatus };
}