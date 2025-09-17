import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, Plus, Minus, Trash2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ItemPickerModal } from './ItemPickerModal';

interface LocationStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: { id: string; name: string; type: string };
}

interface StockItem {
  item_id: string;
  name: string;
  sku: string;
  unit: string;
  default_cost: number;
  reorder_point: number;
  current_stock: number;
}

export function LocationStockModal({ open, onOpenChange, location }: LocationStockModalProps) {
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [debounceMap, setDebounceMap] = useState<Record<string, NodeJS.Timeout>>({});
  const [editingStock, setEditingStock] = useState<Record<string, string>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current stock for this location
  const { data: stockItems = [], refetch: refetchStock } = useQuery({
    queryKey: ['location-stock', location?.id],
    queryFn: async () => {
      if (!location?.id) return [];
      
      // Get stock balances using the inventory function
      const { data: balances, error: balanceError } = await supabase
        .rpc('get_item_location_balances', { location_uuid: location.id });
      
      if (balanceError) throw balanceError;
      
      // Filter for items with stock > 0
      const locationBalances = balances?.filter(
        (balance: any) => (balance as any).current_stock > 0
      ) || [];
      
      if (locationBalances.length === 0) return [];
      
      // Get item details
      const itemIds = locationBalances.map((b: any) => b.item_id);
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, name, sku, unit, default_cost, reorder_point')
        .in('id', itemIds)
        .eq('is_active', true);
        
      if (itemsError) throw itemsError;
      
      // Combine data
      return items?.map(item => {
        const balance = locationBalances.find((b: any) => b.item_id === item.id);
        return {
          item_id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          default_cost: item.default_cost,
          reorder_point: item.reorder_point,
          current_stock: (balance as any)?.current_stock || 0
        };
      }) || [];
    },
    enabled: !!location?.id && open
  });

  // Stock adjustment mutation
  const adjustStockMutation = useMutation({
    mutationFn: async ({ itemId, adjustment, reason }: {
      itemId: string;
      adjustment: number;
      reason: string;
    }) => {
      console.log('🚀 Starting stock adjustment:', { itemId, locationId: location?.id, adjustment, reason });
      
      // Determine direction based on adjustment
      const direction = adjustment > 0 ? 'in' : 'out';
      const qty = Math.abs(adjustment);
      
      const { data, error } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: itemId,
          location_id: location?.id,
          direction: direction,
          qty: qty,
          reference: `Stock adjustment: ${reason}`,
          notes: `${reason} via location stock modal`,
          status: 'approved', // Auto-approve admin stock adjustments
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Stock adjustment error:', error);
        throw error;
      }
      
      console.log('✅ Stock adjustment success:', data);
      return data;
    },
    onSuccess: async (data) => {
      console.log('🔄 Refreshing stock data after successful adjustment');
      
      // Small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Invalidate multiple related query keys to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['item-location-balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      
      // Force refetch this specific query
      await refetchStock();
    },
    onError: (error: any) => {
      console.error('💥 Stock adjustment failed:', error);
      toast({
        title: "Stock Update Failed",
        description: error.message || "Failed to update stock. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Debounced button handler
  const debouncedAdjustStock = useCallback((itemId: string, adjustment: number, reason: string) => {
    // Clear existing timeout for this item
    if (debounceMap[itemId]) {
      clearTimeout(debounceMap[itemId]);
    }

    // Set new timeout
    const timeoutId = setTimeout(() => {
      adjustStockMutation.mutate({ itemId, adjustment, reason });
      setDebounceMap(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    }, 200);

    setDebounceMap(prev => ({ ...prev, [itemId]: timeoutId }));
  }, [adjustStockMutation, debounceMap]);

  // Button handlers
  const handleIncrease = useCallback((itemId: string) => {
    console.log('🔽 + button clicked for item:', itemId);
    debouncedAdjustStock(itemId, 1, 'Quick add');
  }, [debouncedAdjustStock]);

  const handleDecrease = useCallback((itemId: string, currentStock: number) => {
    console.log('🔽 - button clicked for item:', itemId, 'current stock:', currentStock);
    if (currentStock <= 0) return;
    debouncedAdjustStock(itemId, -1, 'Quick remove');
  }, [debouncedAdjustStock]);

  const handleDelete = useCallback((itemId: string, itemName: string, currentStock: number) => {
    console.log('🔽 🗑 button clicked for item:', itemId, itemName, 'current stock:', currentStock);
    if (currentStock <= 0) return;
    
    if (window.confirm(`Remove all ${itemName} from ${location?.name}? This will set stock to 0.`)) {
      debouncedAdjustStock(itemId, -currentStock, 'Remove from location');
    }
  }, [debouncedAdjustStock, location?.name]);

  const handleItemAdded = useCallback(() => {
    console.log('🔄 Item added, refreshing stock');
    setShowItemPicker(false);
    refetchStock();
  }, [refetchStock]);

  const handleDirectStockChange = useCallback((itemId: string, newStock: string, currentStock: number) => {
    const newStockNum = parseInt(newStock);
    if (isNaN(newStockNum) || newStockNum < 0) return;
    
    const adjustment = newStockNum - currentStock;
    if (adjustment !== 0) {
      const reason = adjustment > 0 ? 'Stock adjustment (increase)' : 'Stock adjustment (decrease)';
      debouncedAdjustStock(itemId, adjustment, reason);
    }
  }, [debouncedAdjustStock]);

  if (!location) return null;

  // Calculate metrics
  const totalValue = stockItems.reduce((sum, item) => sum + (item.current_stock * item.default_cost), 0);
  const lowStockItems = stockItems.filter(item => item.current_stock <= item.reorder_point);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock at {location.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{stockItems.length}</p>
                  <p className="text-sm text-muted-foreground">Items</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">£{totalValue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">{lowStockItems.length}</p>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                </CardContent>
              </Card>
            </div>

            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <p className="font-medium text-orange-800">Low Stock Alert</p>
                  </div>
                  <p className="text-sm text-orange-700">
                    {lowStockItems.length} item(s) are at or below their reorder point
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Stock Items List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Inventory Items</h3>
                <Button 
                  onClick={() => setShowItemPicker(true)} 
                  size="sm"
                  disabled={adjustStockMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
              
              {stockItems.map((item) => {
                const isLowStock = item.current_stock <= item.reorder_point;
                const isPending = adjustStockMutation.isPending;
                
                return (
                  <Card key={item.item_id} className={isLowStock ? "border-orange-200" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.name}</p>
                            {isLowStock && item.current_stock > 0 && (
                              <Badge variant="outline" className="text-orange-600 border-orange-200">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span>Available: {item.current_stock}</span>
                            <span>Reorder at: {item.reorder_point}</span>
                            <span>Unit: {item.unit}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                           <div className="text-right">
                             <Input
                               type="number"
                               value={editingStock[item.item_id] !== undefined ? editingStock[item.item_id] : item.current_stock.toString()}
                               onChange={(e) => {
                                 setEditingStock(prev => ({ ...prev, [item.item_id]: e.target.value }));
                               }}
                               onBlur={(e) => {
                                 const newValue = e.target.value;
                                 handleDirectStockChange(item.item_id, newValue, item.current_stock);
                                 setEditingStock(prev => {
                                   const updated = { ...prev };
                                   delete updated[item.item_id];
                                   return updated;
                                 });
                               }}
                               onKeyPress={(e) => {
                                 if (e.key === 'Enter') {
                                   e.currentTarget.blur();
                                 }
                               }}
                               className="w-20 text-lg font-semibold text-right"
                               min="0"
                               disabled={isPending}
                             />
                             <p className="text-sm text-muted-foreground mt-1">{item.unit}</p>
                           </div>
                          
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleIncrease(item.item_id)}
                              disabled={isPending}
                              title="Add 1 unit"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDecrease(item.item_id, item.current_stock)}
                              disabled={item.current_stock <= 0 || isPending}
                              title="Remove 1 unit"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDelete(item.item_id, item.name, item.current_stock)}
                              disabled={item.current_stock <= 0 || isPending}
                              title="Remove all from location"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {stockItems.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No Items in Stock</h3>
                    <p className="text-muted-foreground mb-4">
                      This location doesn't have any items yet.
                    </p>
                    <Button onClick={() => setShowItemPicker(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Item
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Picker Modal - No navigation, just data operations */}
      {showItemPicker && (
        <ItemPickerModal
          open={showItemPicker}
          onOpenChange={setShowItemPicker}
          location={location}
          onItemAdded={handleItemAdded}
        />
      )}
    </>
  );
}