import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Check, Clock, AlertTriangle, Edit, Truck, Calendar, PoundSterling, FileText, ExternalLink, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { PartsOrderModal } from './PartsOrderModal';
import { formatCurrency } from '@/lib/currency';
import { Link } from 'react-router-dom';

interface PartsSectionProps {
  orderId: string;
  partRequired?: boolean;
  partDetails?: string | null;
  partsOrdered?: boolean;
  partsDelivered?: boolean;
  onUpdate?: () => void;
}

export function PartsSection({ 
  orderId, 
  partRequired, 
  partDetails, 
  partsOrdered,
  partsDelivered,
  onUpdate 
}: PartsSectionProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPartsOrderModal, setShowPartsOrderModal] = useState(false);

  // Fetch existing parts orders for this order
  const { data: partsOrders = [] } = useQuery({
    queryKey: ['order-parts', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_parts')
        .select(`
          *,
          inventory_suppliers(name, contact_name, contact_email, contact_phone),
          purchase_orders(id, po_number, status, total_amount, expected_delivery_date, reference)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!partRequired
  });

  const handleMarkPartsDelivered = async () => {
    if (!partRequired || !partsOrdered) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          parts_delivered: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Parts marked as delivered",
      });

      onUpdate?.();
    } catch (error) {
      console.error('Error marking parts as delivered:', error);
      toast({
        title: "Error",
        description: "Failed to mark parts as delivered",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!partRequired) {
    return null;
  }

  const getPartsStatus = () => {
    if (partsDelivered) {
      return {
        icon: Check,
        text: "Parts Delivered",
        variant: "default" as const,
        color: "text-green-600"
      };
    }
    if (partsOrdered) {
      return {
        icon: Truck,
        text: "Parts Ordered",
        variant: "secondary" as const,
        color: "text-blue-600"
      };
    }
    return {
      icon: Clock,
      text: "Parts Required",
      variant: "outline" as const,
      color: "text-orange-600"
    };
  };

  const status = getPartsStatus();
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          Parts Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Parts Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${status.color}`} />
            <Badge variant={status.variant} className={status.color}>
              {status.text}
            </Badge>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {!partsOrdered && (
              <Button
                onClick={() => setShowPartsOrderModal(true)}
                disabled={isUpdating}
                size="sm"
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                Order Parts
              </Button>
            )}
            {partsOrdered && !partsDelivered && (
              <Button
                onClick={handleMarkPartsDelivered}
                disabled={isUpdating}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                {isUpdating ? 'Updating...' : 'Mark as Delivered'}
              </Button>
            )}
          </div>
        </div>

        {/* Parts Details */}
        {partDetails && (
          <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm">Required Parts</h4>
                <p className="text-blue-800 dark:text-blue-200 text-sm mt-1">{partDetails}</p>
              </div>
            </div>
          </div>
        )}

        {/* Existing Parts Orders */}
        {partsOrders.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Parts Orders</h4>
            {partsOrders.map((order: any) => (
              <Card key={order.id} className="p-4 bg-muted/50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Supplier</div>
                    <div className="font-medium">{order.inventory_suppliers?.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Reference</div>
                    <div className="font-medium">{order.order_number}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Net Cost</div>
                    <div className="font-medium flex items-center gap-1">
                      <PoundSterling className="h-3 w-3" />
                      {formatCurrency(order.net_cost)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Expected Delivery</div>
                    <div className="font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {order.expected_delivery_date 
                        ? new Date(order.expected_delivery_date).toLocaleDateString()
                        : 'Not specified'
                      }
                    </div>
                  </div>
                  <div className="flex items-end justify-end">
                    <Link to={`/admin/orders/${orderId}`}>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <Eye className="h-3 w-3" />
                        View Order
                      </Button>
                    </Link>
                  </div>
                </div>
                {order.items_ordered && Array.isArray(order.items_ordered) && order.items_ordered.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-muted-foreground mb-2">Items</div>
                    <div className="space-y-1">
                       {order.items_ordered.map((item: any, index: number) => (
                         <div key={index} className="text-sm flex justify-between">
                           <span>{item.description}</span>
                           <span>Qty: {item.quantity} @ {formatCurrency(item.unit_cost)}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                 )}

                {/* Purchase Order Information */}
                {order.purchase_orders && (
                  <div className="mt-3 pt-3 border-t bg-blue-50/50 dark:bg-blue-950/20 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Purchase Order: {order.purchase_orders.po_number}</span>
                        <Badge variant={order.purchase_orders.status === 'delivered' ? 'default' : 'secondary'}>
                          {order.purchase_orders.status}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/admin/inventory?tab=purchase-orders`, '_blank')}
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">PO Total:</span>
                        <div className="font-medium">{formatCurrency(order.purchase_orders.total_amount)}</div>
                      </div>
                      {order.purchase_orders.reference && (
                        <div>
                          <span className="text-muted-foreground">Reference:</span>
                          <div className="font-medium">{order.purchase_orders.reference}</div>
                        </div>
                      )}
                      {order.purchase_orders.expected_delivery_date && (
                        <div>
                          <span className="text-muted-foreground">Expected:</span>
                          <div className="font-medium">{new Date(order.purchase_orders.expected_delivery_date).toLocaleDateString()}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {order.notes && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-muted-foreground">Notes</div>
                    <div className="text-sm">{order.notes}</div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Instructions */}
        {!partsOrdered && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Parts Workflow:</p>
            <ul className="space-y-1">
              <li>1. Review parts requirements above</li>
              <li>2. Click "Order Parts" to create a detailed parts order with auto-generated PO number</li>
              <li>3. Track supplier details, costs, and delivery dates through PO system</li>
              <li>4. Mark as delivered when parts arrive</li>
              <li>5. Job will move to scheduling once parts are confirmed ordered</li>
            </ul>
          </div>
        )}
      </CardContent>

      <PartsOrderModal
        open={showPartsOrderModal}
        onOpenChange={setShowPartsOrderModal}
        orderId={orderId}
        partDetails={partDetails}
        onSuccess={onUpdate}
      />
    </Card>
  );
}