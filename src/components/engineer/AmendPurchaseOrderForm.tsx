import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Package, Plus, Trash2, Eye, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePurchaseOrderForStockRequest, useAmendPurchaseOrder } from '@/hooks/usePurchaseOrderAmendment';
import { useUpdateStockRequestLines, useCreateStockRequest } from '@/hooks/useStockRequests';
import { AmendmentPreview } from './AmendmentPreview';
import { formatCurrency, calculateLineTotal } from '@/lib/currency';

interface AmendPurchaseOrderFormProps {
  engineerId: string;
  stockRequestId: string;
  onClose: () => void;
}

interface AmendmentItem {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  notes: string;
}

interface VanStockItem {
  item_id: string;
  item_name: string;
  current_quantity: number;
  unit: string;
}

export const AmendPurchaseOrderForm: React.FC<AmendPurchaseOrderFormProps> = ({
  engineerId,
  stockRequestId,
  onClose
}) => {
  const [amendmentItems, setAmendmentItems] = useState<AmendmentItem[]>([]);
  const [amendmentReason, setAmendmentReason] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<any>(null);
  
  const { user } = useAuth();
  const amendPO = useAmendPurchaseOrder();
  const updateStockRequestLines = useUpdateStockRequestLines();
  const createStockRequest = useCreateStockRequest();
  
  // Get the PO linked to this stock request
  const { data: purchaseOrder, isLoading: poLoading } = usePurchaseOrderForStockRequest(stockRequestId);
  
  // Get the original stock request to show baseline items (only if stockRequestId exists)
  const { data: stockRequest, isLoading: srLoading } = useQuery({
    queryKey: ['stock-request-for-amendment', stockRequestId],
    queryFn: async () => {
      if (!stockRequestId) return null; // No existing request for new requests
      
      console.log('Fetching stock request for amendment:', stockRequestId);
      const { data, error } = await supabase
        .from('stock_requests')
        .select(`
          *,
          lines:stock_request_lines(
            *,
            item:inventory_items(name, sku, unit)
          )
        `)
        .eq('id', stockRequestId)
        .single();
      
      if (error) {
        console.error('Error fetching stock request:', error);
        throw error;
      }
      
      console.log('Stock request fetched:', data);
      return data;
    },
    enabled: !!stockRequestId // Only run if stockRequestId exists
  });
  
  // Get all inventory items for adding new items
  const { data: allItems } = useQuery({
    queryKey: ['inventory-items-for-amendment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku, unit')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Get current van stock for the engineer
  const { data: vanStock } = useQuery({
    queryKey: ['van-stock', engineerId],
    queryFn: async () => {
      // First get the engineer's van location
      const { data: vanLocation, error: locationError } = await supabase
        .from('inventory_locations')
        .select('id')
        .eq('engineer_id', engineerId)
        .eq('type', 'van')
        .maybeSingle();

      if (locationError || !vanLocation) {
        console.error('No van location found for engineer:', engineerId);
        return [];
      }

      // Get all inventory transactions for this location to calculate current stock
      const { data: transactions, error: txnError } = await supabase
        .from('inventory_txns')
        .select(`
          item_id,
          direction,
          qty,
          status,
          inventory_items!inner(id, name, sku, unit)
        `)
        .eq('location_id', vanLocation.id)
        .eq('status', 'approved');

      if (txnError) {
        console.error('Error fetching inventory transactions:', txnError);
        return [];
      }

      // Calculate current stock levels by item
      const stockLevels = new Map<string, { item_name: string; unit: string; total: number }>();
      
      transactions?.forEach((txn: any) => {
        const itemId = txn.item_id;
        const qty = txn.direction === 'in' ? txn.qty : -txn.qty;
        
        if (!stockLevels.has(itemId)) {
          stockLevels.set(itemId, {
            item_name: txn.inventory_items.name,
            unit: txn.inventory_items.unit,
            total: 0
          });
        }
        
        const current = stockLevels.get(itemId)!;
        current.total += qty;
      });

      // Convert to array format, excluding items with zero or negative stock
      return Array.from(stockLevels.entries())
        .filter(([_, data]) => data.total > 0)
        .map(([item_id, data]) => ({
          item_id,
          item_name: data.item_name,
          current_quantity: data.total,
          unit: data.unit
        }));
    },
    enabled: !!engineerId
  });

  // Pre-populate with original stock request items as baseline (only if stock request exists)
  useEffect(() => {
    if (stockRequest?.lines) {
      console.log('Setting up amendment items from stock request lines:', stockRequest.lines);
      
      const items = stockRequest.lines.map((line, index) => ({
        id: `original-${line.id}`,
        item_id: line.item_id,
        item_name: line.item.name,
        quantity: line.qty, // Start with original requested quantity
        notes: line.notes || ''
      }));
      setAmendmentItems(items);
    } else if (!stockRequestId) {
      // For new requests, start with empty items
      setAmendmentItems([]);
    }
  }, [stockRequest, stockRequestId]);

  // Helper function to get current van stock for an item
  const getCurrentVanStock = (itemId: string): number => {
    const stockItem = vanStock?.find(item => item.item_id === itemId);
    return stockItem?.current_quantity || 0;
  };

  // Helper function to calculate final quantities (always add to current stock)
  const calculateFinalQuantity = (item: AmendmentItem): number => {
    const currentStock = getCurrentVanStock(item.item_id);
    return currentStock + item.quantity;
  };

  console.log('AmendPurchaseOrderForm state:', { 
    stockRequest, 
    purchaseOrder, 
    amendmentItems,
    poLoading, 
    srLoading 
  });

  const addNewItem = () => {
    const newItem: AmendmentItem = {
      id: `new-${Date.now()}`,
      item_id: '',
      item_name: '',
      quantity: 1,
      notes: ''
    };
    setAmendmentItems([...amendmentItems, newItem]);
  };

  const removeItem = (id: string) => {
    setAmendmentItems(amendmentItems.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof AmendmentItem, value: any) => {
    setAmendmentItems(amendmentItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // If item_id changed, update item_name
        if (field === 'item_id') {
          const selectedItem = allItems?.find(i => i.id === value);
          updated.item_name = selectedItem?.name || '';
        }
        
        return updated;
      }
      return item;
    }));
  };

  const generatePreview = async () => {
    if (!purchaseOrder || !amendmentReason.trim()) {
      return;
    }

    const validItems = amendmentItems.filter(item => 
      item.item_id && item.quantity > 0
    );

    if (validItems.length === 0) {
      return;
    }

    try {
      // Get current PO lines with costs
      const currentLines = purchaseOrder.purchase_order_lines || [];
      
      // Calculate preview data by getting unit costs for each item
      const previewItems = await Promise.all(validItems.map(async (item) => {
        // Try to find existing cost from current PO
        const existingLine = currentLines.find((line: any) => line.item_id === item.item_id);
        let unitCost = existingLine?.unit_cost || 0;
        
        // If no existing cost, get from inventory item
        if (unitCost === 0) {
          const { data: inventoryItem } = await supabase
            .from('inventory_items')
            .select('default_cost')
            .eq('id', item.item_id)
            .single();
          
          unitCost = inventoryItem?.default_cost || 0;
        }

        // Find original quantities for comparison
        const originalLine = currentLines.find((line: any) => line.item_id === item.item_id);
        const oldQuantity = originalLine?.quantity || 0;
        const oldLineTotal = calculateLineTotal(oldQuantity, unitCost);
        const newLineTotal = calculateLineTotal(item.quantity, unitCost);

        return {
          item_id: item.item_id,
          item_name: item.item_name,
          item_sku: allItems?.find(i => i.id === item.item_id)?.sku || '',
          old_quantity: oldQuantity,
          new_quantity: item.quantity,
          unit_cost: unitCost,
          old_line_total: oldLineTotal,
          new_line_total: newLineTotal
        };
      }));

      const oldTotal = purchaseOrder.total_amount || 0;
      const newTotal = previewItems.reduce((sum, item) => sum + item.new_line_total, 0);

      setPreviewData({
        items: previewItems,
        oldTotal,
        newTotal,
        poNumber: purchaseOrder.po_number
      });
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  };

  const handleSubmit = async () => {
    if (!amendmentReason.trim()) {
      return;
    }

    const validItems = amendmentItems.filter(item => 
      item.item_id && item.quantity > 0
    );

    if (validItems.length === 0) {
      return;
    }

    try {
      if (purchaseOrder) {
        // Use the enhanced amendment hook - pass only the additional quantities, not the final total
        await amendPO.mutateAsync({
          purchaseOrderId: purchaseOrder.id,
          items: validItems.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity, // Only the additional quantity, not the final total
            notes: item.notes
          })),
          amendmentReason,
          engineerId
        });
      } else if (stockRequestId) {
        // For existing stock requests without PO, use the enhanced amendment hook
        await updateStockRequestLines.mutateAsync({
          requestId: stockRequestId,
          lines: validItems.map(item => ({
            item_id: item.item_id,
            qty: item.quantity, // Only the additional quantity, consistent with PO path
            notes: item.notes
          })),
          status: 'submitted' // Reset to submitted for review after amendment
        });

        // Update the request notes separately to include amendment reason
        const itemsList = validItems.map(item => {
          const finalQty = calculateFinalQuantity(item);
          const currentStock = getCurrentVanStock(item.item_id);
          return `- ${item.item_name}: +${item.quantity} (current: ${currentStock}, total will be: ${finalQty})${item.notes ? ` (${item.notes})` : ''}`;
        }).join('\n');

        const { error: notesError } = await supabase
          .from('stock_requests')
          .update({
            notes: `AMENDMENT REQUEST (Additional Stock): ${amendmentReason}\n\nRequested items:\n${itemsList}\n\nOriginal notes: ${stockRequest?.notes || 'None'}`
          })
          .eq('id', stockRequestId);

        if (notesError) {
          console.error('Error updating amendment notes:', notesError);
        }

        console.log('Amendment request created successfully');
      } else {
        // For new stock requests, create a completely new request
        const { data: vanLocation } = await supabase
          .from('inventory_locations')
          .select('id')
          .eq('engineer_id', engineerId)
          .eq('type', 'van')
          .single();

        if (!vanLocation) {
          throw new Error('Van location not found for engineer');
        }

        await createStockRequest.mutateAsync({
          engineer_id: engineerId,
          destination_location_id: vanLocation.id,
          priority: 'medium',
          notes: `STOCK ISSUE REPORT: ${amendmentReason}\n\nRequested items:\n${validItems.map(item => `- ${item.item_name}: ${item.quantity}${item.notes ? ` (${item.notes})` : ''}`).join('\n')}`,
          lines: validItems.map(item => ({
            item_id: item.item_id,
            qty: item.quantity,
            notes: item.notes
          }))
        });

        console.log('New stock request created successfully');
      }

      onClose();
    } catch (error) {
      console.error('Error submitting amendment:', error);
    }
  };

  if (poLoading || srLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (stockRequestId && !stockRequest) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <span>Could not load stock request details. Please try again.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Package className="h-5 w-5" />
            {purchaseOrder 
              ? `Amend Purchase Order - ${purchaseOrder.po_number}` 
              : stockRequestId 
                ? 'Request Additional Stock' 
                : 'Report Stock Issue / Request Additional Stock'
            }
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-blue-700">
            {stockRequestId 
              ? 'Request additional stock to be added to your current van inventory. The quantities you specify will be added to what you currently have in your van.'
              : 'Report a stock issue or request additional stock for your van. You can add multiple items to your request.'
            }
          </p>

          <div className="flex items-start gap-2 p-3 bg-blue-100 rounded-lg">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              The quantities you enter will be ADDED to your current van stock. For example, if you have 48 cables and request 12 more, you'll have 60 total.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reason">Reason for Amendment *</Label>
          <Textarea
            id="reason"
            value={amendmentReason}
            onChange={(e) => setAmendmentReason(e.target.value)}
            placeholder="Explain why the purchase order needs to be amended (e.g., incorrect quantities found, additional items needed)..."
            rows={3}
            required
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Items</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addNewItem}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          {amendmentItems.map((item) => {
            const currentStock = getCurrentVanStock(item.item_id);
            const finalQuantity = calculateFinalQuantity(item);
            
            return (
              <Card key={item.id} className="p-4">
                <div className="grid grid-cols-12 gap-4 items-end">
                  <div className="col-span-5">
                    <Label>Item</Label>
                    <Select
                      value={item.item_id}
                      onValueChange={(value) => updateItem(item.id, 'item_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allItems?.map((inventoryItem) => (
                          <SelectItem key={inventoryItem.id} value={inventoryItem.id}>
                            {inventoryItem.name} ({inventoryItem.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {item.item_id && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Current van stock: {currentStock}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <Label>Additional Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                    />
                    {item.item_id && (
                      <p className="text-xs text-green-600 mt-1">
                        Final total: {finalQuantity}
                      </p>
                    )}
                  </div>

                  <div className="col-span-4">
                    <Label>Notes</Label>
                    <Input
                      value={item.notes}
                      onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                      placeholder="Additional notes..."
                    />
                  </div>

                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {amendmentItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No items added yet. Click "Add Item" to start.</p>
            </div>
          )}
        </div>
      </div>

      {showPreview && previewData ? (
        <AmendmentPreview 
          items={previewData.items}
          oldTotal={previewData.oldTotal}
          newTotal={previewData.newTotal}
          poNumber={previewData.poNumber}
        />
      ) : (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {purchaseOrder && (
            <Button 
              variant="outline"
              onClick={generatePreview}
              disabled={!amendmentReason.trim() || amendmentItems.length === 0}
              className="bg-gray-100 hover:bg-gray-200"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Changes
            </Button>
          )}
          <Button 
            onClick={handleSubmit}
            disabled={amendPO.isPending || updateStockRequestLines.isPending || createStockRequest.isPending || !amendmentReason.trim() || amendmentItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {(amendPO.isPending || updateStockRequestLines.isPending || createStockRequest.isPending)
              ? 'Submitting...' 
              : purchaseOrder 
                ? 'Request Additional Stock'
                : stockRequestId
                  ? 'Submit Additional Stock Request'
                  : 'Submit Stock Issue Report'
            }
          </Button>
        </div>
      )}

      {showPreview && (
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => setShowPreview(false)}>
            Back to Edit
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={amendPO.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {amendPO.isPending ? 'Submitting...' : 'Confirm Additional Stock Request'}
          </Button>
        </div>
      )}
    </div>
  );
};