import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Package, Calendar, FileText, Truck } from 'lucide-react';
import { format } from 'date-fns';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  total_amount: number;
  expected_delivery_date: string | null;
  created_at: string;
  notes: string | null;
  supplier_id: string | null;
  inventory_suppliers: {
    name: string;
  } | null;
  purchase_order_lines: Array<{
    item_name: string;
    quantity: number;
    unit_cost: number;
  }>;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'status-pending';
    case 'ordered': return 'status-sent';
    case 'received': return 'status-accepted';
    case 'cancelled': return 'status-rejected';
    default: return 'badge-cream';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return <Package className="h-4 w-4" />;
    case 'ordered': return <Truck className="h-4 w-4" />;
    case 'received': return <FileText className="h-4 w-4" />;
    default: return <Package className="h-4 w-4" />;
  }
};

export function EngineerPurchaseOrders() {
  const { user } = useAuth();

  // Get engineer profile
  const { data: engineer } = useQuery({
    queryKey: ['engineer-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get purchase orders assigned to this engineer
  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['engineer-purchase-orders', engineer?.id],
    queryFn: async () => {
      if (!engineer?.id) return [];

      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          status,
          total_amount,
          expected_delivery_date,
          created_at,
          notes,
          supplier_id,
          inventory_suppliers(name),
          purchase_order_lines(item_name, quantity, unit_cost)
        `)
        .eq('engineer_id', engineer.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !!engineer?.id
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            My Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!purchaseOrders.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            My Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No purchase orders assigned to you yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          My Purchase Orders
          <Badge variant="secondary" className="ml-auto">
            {purchaseOrders.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {purchaseOrders.map((po) => (
            <Card key={po.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-base">{po.po_number}</h4>
                      <Badge className={getStatusColor(po.status)}>
                        {getStatusIcon(po.status)}
                        <span className="ml-1 capitalize">{po.status}</span>
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {po.inventory_suppliers && (
                        <span className="flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          {po.inventory_suppliers.name}
                        </span>
                      )}
                      
                      {po.expected_delivery_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Expected: {format(new Date(po.expected_delivery_date), 'MMM dd, yyyy')}
                        </span>
                      )}
                      
                      <span className="font-medium text-foreground">
                        £{po.total_amount.toFixed(2)}
                      </span>
                    </div>
                    
                    {po.purchase_order_lines.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-2">Items:</p>
                        <div className="space-y-1">
                          {po.purchase_order_lines.slice(0, 3).map((line, index) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span>{line.item_name}</span>
                              <span className="text-muted-foreground">
                                {line.quantity} × £{line.unit_cost.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {po.purchase_order_lines.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{po.purchase_order_lines.length - 3} more items
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 sm:items-end">
                    <div className="text-xs text-muted-foreground">
                      Created: {format(new Date(po.created_at), 'MMM dd, yyyy')}
                    </div>
                  </div>
                </div>
                
                {po.notes && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Notes:</span> {po.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}