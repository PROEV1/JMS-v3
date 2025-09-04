import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

export function FixOrderStatusButton({ orderId }: { orderId?: string }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleFixStatus = async () => {
    if (!orderId) {
      toast({
        title: "Error", 
        description: "Order ID is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fix-order-status', {
        body: { order_id: orderId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Order status recalculated: ${data?.order?.status_enhanced}`,
      });

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error fixing order status:', error);
      toast({
        title: "Error",
        description: "Failed to fix order status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleFixStatus}
      disabled={loading}
      variant="outline"
      size="sm"
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      Fix Status
    </Button>
  );
}