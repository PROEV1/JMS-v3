import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Package, Truck, AlertCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LocationChargerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: any;
}

interface ChargerStock {
  item_id: string;
  item_name: string;
  sku: string;
  on_hand: number;
  reorder_point: number;
  recent_dispatches: {
    id: string;
    order_number: string;
    status: string;
    created_at: string;
  }[];
}

export function LocationChargerModal({ open, onOpenChange, location }: LocationChargerModalProps) {
  const { data: chargerStock = [], isLoading } = useQuery({
    queryKey: ['location-charger-stock', location?.id],
    queryFn: async () => {
      if (!location?.id) return [];

      // Get actual charger inventory assigned to this location
      const { data: chargerInventory, error } = await supabase
        .from('charger_inventory')
        .select(`
          id,
          serial_number,
          status,
          notes,
          created_at,
          charger_item_id,
          inventory_items (
            id,
            name,
            sku
          )
        `)
        .eq('location_id', location.id);

      if (error) throw error;

      // Group by charger type and return stock info
      const stockMap = new Map<string, ChargerStock>();
      
      (chargerInventory || []).forEach((charger: any) => {
        const itemId = charger.charger_item_id;
        const item = charger.inventory_items;
        
        if (!stockMap.has(itemId)) {
          stockMap.set(itemId, {
            item_id: itemId,
            item_name: item?.name || 'Unknown Charger',
            sku: item?.sku || 'N/A',
            on_hand: 0,
            reorder_point: 0,
            recent_dispatches: []
          });
        }
        
        const stock = stockMap.get(itemId)!;
        stock.on_hand += 1;
        
        // Add charger details as "dispatch" entries for display
        stock.recent_dispatches.push({
          id: charger.id,
          order_number: `SN: ${charger.serial_number}`,
          status: charger.status || 'available',
          created_at: charger.created_at
        });
      });

      return Array.from(stockMap.values());
    },
    enabled: !!location?.id && open
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'pending_dispatch': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isLowStock = (stock: ChargerStock) => {
    return stock.on_hand <= stock.reorder_point && stock.reorder_point > 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Charger Inventory - {location?.name}
          </DialogTitle>
          {location?.engineer_name && (
            <p className="text-sm text-muted-foreground">
              Engineer: {location.engineer_name}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8">Loading charger inventory...</div>
          ) : chargerStock.length > 0 ? (
            <div className="grid gap-4">
              {chargerStock.map((stock) => (
                <Card key={stock.item_id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isLowStock(stock) ? 'bg-red-100' : 'bg-primary/10'}`}>
                          <Zap className={`w-4 h-4 ${isLowStock(stock) ? 'text-red-600' : 'text-primary'}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{stock.item_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">SKU: {stock.sku}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isLowStock(stock) && (
                          <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Low Stock
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Location Information */}
                    {location?.address && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Location Address: </span>
                        <span className="font-medium">{location.address}</span>
                      </div>
                    )}

                    {/* Recent Dispatches */}
                    {stock.recent_dispatches.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Recent Dispatches</h4>
                        <div className="space-y-2">
                          {stock.recent_dispatches.map((dispatch) => (
                            <div 
                              key={dispatch.id}
                              className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <Package className="w-3 h-3 text-muted-foreground" />
                                <span>{dispatch.order_number}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(dispatch.status)}>
                                  {dispatch.status.replace('_', ' ')}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(dispatch.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      {isLowStock(stock) && (
                        <Button variant="outline" size="sm">
                          Request Stock
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Dispatches
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium mb-2">No Charger Activity</h3>
              <p className="text-sm">This engineer van has no recent charger dispatch history.</p>
            </div>
          )}

          {/* Summary Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {chargerStock.length} charger types with activity
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => window.open('/admin/chargers', '_blank')}>
                <Package className="w-4 h-4 mr-1" />
                Manage Inventory
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}