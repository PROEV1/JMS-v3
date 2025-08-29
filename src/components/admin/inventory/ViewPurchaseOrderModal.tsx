import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ViewPurchaseOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string | null;
}

export function ViewPurchaseOrderModal({ open, onOpenChange, purchaseOrderId }: ViewPurchaseOrderModalProps) {
  const { data: purchaseOrder, isLoading } = useQuery({
    queryKey: ['purchase-order-detail', purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return null;
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          inventory_suppliers(name, contact_name, contact_email, contact_phone),
          profiles!purchase_orders_created_by_fkey(full_name),
          purchase_order_lines(
            id, item_name, quantity, unit_cost, line_total, received_quantity,
            inventory_items(name, sku)
          )
        `)
        .eq('id', purchaseOrderId)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!purchaseOrderId && open
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'received': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!purchaseOrder && !isLoading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Purchase Order Details</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : purchaseOrder ? (
          <div className="space-y-6">
            {/* Header Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-lg">{purchaseOrder.po_number}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getStatusColor(purchaseOrder.status)}>
                    {purchaseOrder.status}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">£{purchaseOrder.total_amount?.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Amount</div>
              </div>
            </div>

            {/* Order Details */}
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Order Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Order Date:</span>
                    <div className="font-medium">{format(new Date(purchaseOrder.order_date), 'dd/MM/yyyy')}</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Expected Delivery:</span>
                    <div className="font-medium">
                      {purchaseOrder.expected_delivery_date 
                        ? format(new Date(purchaseOrder.expected_delivery_date), 'dd/MM/yyyy')
                        : 'TBD'
                      }
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Created By:</span>
                    <div className="font-medium">{purchaseOrder.profiles?.full_name || 'Unknown'}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Supplier Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Supplier:</span>
                    <div className="font-medium">{purchaseOrder.inventory_suppliers?.name || 'No supplier'}</div>
                  </div>
                  {purchaseOrder.inventory_suppliers?.contact_name && (
                    <div>
                      <span className="text-sm text-muted-foreground">Contact:</span>
                      <div className="font-medium">{purchaseOrder.inventory_suppliers.contact_name}</div>
                    </div>
                  )}
                  {purchaseOrder.inventory_suppliers?.contact_email && (
                    <div>
                      <span className="text-sm text-muted-foreground">Email:</span>
                      <div className="font-medium">{purchaseOrder.inventory_suppliers.contact_email}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {purchaseOrder.purchase_order_lines?.map((line: any) => (
                    <div key={line.id} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{line.item_name}</div>
                        {line.inventory_items?.sku && (
                          <div className="text-sm text-muted-foreground">SKU: {line.inventory_items.sku}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {line.quantity} × £{line.unit_cost?.toFixed(2)} = £{line.line_total?.toFixed(2)}
                        </div>
                        {purchaseOrder.status === 'received' && (
                          <div className="text-sm text-muted-foreground">
                            Received: {line.received_quantity}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {purchaseOrder.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{purchaseOrder.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}