
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useOrderStatusSync(orderId: string) {
  const { toast } = useToast();
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    // Set up real-time subscription for order changes
    const orderChannel = supabase
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
            
            // Trigger scheduling refresh to update status counts
            window.dispatchEvent(new CustomEvent('scheduling:refresh'));
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for survey changes that affect this order
    const surveyChannel = supabase
      .channel('survey-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_surveys',
          filter: `order_id=eq.${orderId}`
        },
        async (payload) => {
          console.log('Survey change detected for order:', orderId, payload);
          
          // Survey changed, trigger order status recalculation
          // The database trigger should handle this automatically, but we can force a refresh
          window.dispatchEvent(new CustomEvent('scheduling:refresh'));
          
          // Show appropriate toast based on survey status
          if (payload.eventType === 'UPDATE') {
            const newSurvey = payload.new as any;
            const oldSurvey = payload.old as any;
            
            if (newSurvey.status !== oldSurvey.status) {
              let message = '';
              switch (newSurvey.status) {
                case 'submitted':
                  message = 'Survey submitted for review';
                  break;
                case 'approved':
                  message = 'Survey approved - ready for next steps';
                  break;
                case 'rework_requested':
                  message = 'Survey requires additional work';
                  break;
                default:
                  message = `Survey status updated to: ${newSurvey.status}`;
              }
              
              toast({
                title: "Survey Updated",
                description: message,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(surveyChannel);
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
