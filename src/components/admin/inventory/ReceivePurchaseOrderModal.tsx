import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ReceivePurchaseOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string | null;
}

interface ReceiveItem {
  id: string;
  item_name: string;
  ordered_quantity: number;
  received_quantity: number;
  previously_received: number;
  receiving_now: number;
}

export function ReceivePurchaseOrderModal({ open, onOpenChange, purchaseOrderId }: ReceivePurchaseOrderModalProps) {
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch purchase order details
  const { data: purchaseOrder, isLoading } = useQuery({
    queryKey: ['purchase-order-receive', purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return null;
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          inventory_suppliers(name),
          purchase_order_lines(
            id, item_name, quantity, received_quantity
          )
        `)
        .eq('id', purchaseOrderId)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!purchaseOrderId && open
  });

  // Populate form when purchase order data loads
  useEffect(() => {
    if (purchaseOrder) {
      const items = purchaseOrder.purchase_order_lines?.map((line: any) => ({
        id: line.id,
        item_name: line.item_name,
        ordered_quantity: line.quantity,
        received_quantity: line.received_quantity,
        previously_received: line.received_quantity,
        receiving_now: Math.max(0, line.quantity - line.received_quantity) // Default to remaining quantity
      })) || [];
      
      setReceiveItems(items);
    }
  }, [purchaseOrder]);

  const updateReceiveQuantity = (id: string, quantity: number) => {
    setReceiveItems(prevItems => 
      prevItems.map(item => 
        item.id === id 
          ? { ...item, receiving_now: Math.max(0, quantity) }
          : item
      )
    );
  };

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!purchaseOrderId) throw new Error('No purchase order ID');
      
      // Update received quantities for each line
      for (const item of receiveItems) {
        if (item.receiving_now > 0) {
          const newReceivedQuantity = item.previously_received + item.receiving_now;
          
          const { error } = await supabase
            .from('purchase_order_lines')
            .update({
              received_quantity: newReceivedQuantity
            })
            .eq('id', item.id);
            
          if (error) throw error;
        }
      }

      // Check if all items are fully received
      const allItemsReceived = receiveItems.every(item => 
        (item.previously_received + item.receiving_now) >= item.ordered_quantity
      );

      // Update PO status if all items received
      if (allItemsReceived) {
        const { error: statusError } = await supabase
          .from('purchase_orders')
          .update({
            status: 'received' as const,
            actual_delivery_date: new Date().toISOString().split('T')[0]
          })
          .eq('id', purchaseOrderId);
          
        if (statusError) throw statusError;
      }
    },
    onSuccess: () => {
      const totalReceiving = receiveItems.reduce((sum, item) => sum + item.receiving_now, 0);
      
      toast({
        title: "Success",
        description: `Received ${totalReceiving} items successfully`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-receive', purchaseOrderId] });
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to receive items",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasItemsToReceive = receiveItems.some(item => item.receiving_now > 0);
    
    if (!hasItemsToReceive) {
      toast({
        title: "Error",
        description: "Please specify quantities to receive",
        variant: "destructive",
      });
      return;
    }

    receiveMutation.mutate();
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!purchaseOrder) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Purchase Order - {purchaseOrder.po_number}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* PO Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Supplier</div>
              <div className="font-medium">{purchaseOrder.inventory_suppliers?.name || 'No supplier'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Order Date</div>
              <div className="font-medium">{format(new Date(purchaseOrder.order_date), 'dd/MM/yyyy')}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Items to Receive</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {receiveItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-center p-3 border rounded-lg">
                    <div className="col-span-4">
                      <div className="font-medium">{item.item_name}</div>
                    </div>
                    
                    <div className="col-span-2 text-center">
                      <div className="text-sm text-muted-foreground">Ordered</div>
                      <div className="font-medium">{item.ordered_quantity}</div>
                    </div>
                    
                    <div className="col-span-2 text-center">
                      <div className="text-sm text-muted-foreground">Previously Received</div>
                      <div className="font-medium">{item.previously_received}</div>
                    </div>
                    
                    <div className="col-span-2 text-center">
                      <div className="text-sm text-muted-foreground">Remaining</div>
                      <div className="font-medium">{item.ordered_quantity - item.previously_received}</div>
                    </div>
                    
                    <div className="col-span-2">
                      <Label htmlFor={`receive-${item.id}`} className="text-sm">Receiving Now</Label>
                      <Input
                        id={`receive-${item.id}`}
                        type="number"
                        value={item.receiving_now}
                        onChange={(e) => updateReceiveQuantity(item.id, parseInt(e.target.value) || 0)}
                        min="0"
                        max={item.ordered_quantity - item.previously_received}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={receiveMutation.isPending}
              >
                {receiveMutation.isPending ? 'Receiving...' : 'Receive Items'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}