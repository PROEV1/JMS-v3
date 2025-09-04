import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Package, Plus, Trash2, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePurchaseOrderForStockRequest, useAmendPurchaseOrder } from '@/hooks/usePurchaseOrderAmendment';
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
  
  // Get the PO linked to this stock request
  const { data: purchaseOrder, isLoading: poLoading } = usePurchaseOrderForStockRequest(stockRequestId);
  
  // Get the original stock request to show baseline items
  const { data: stockRequest, isLoading: srLoading } = useQuery({
    queryKey: ['stock-request-for-amendment', stockRequestId],
    queryFn: async () => {
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
    enabled: !!stockRequestId
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

  // Pre-populate with original stock request items as baseline
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
    }
  }, [stockRequest]);

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
        // Use the enhanced amendment hook
        await amendPO.mutateAsync({
          purchaseOrderId: purchaseOrder.id,
          items: validItems.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity,
            notes: item.notes
          })),
          amendmentReason,
          engineerId
        });
      } else {
        // For stock requests without PO, create amendment request
        const { error: updateError } = await supabase
          .from('stock_requests')
          .update({
            notes: `AMENDMENT REQUEST: ${amendmentReason}\n\nRequested items:\n${validItems.map(item => `- ${item.item_name}: ${item.quantity}${item.notes ? ` (${item.notes})` : ''}`).join('\n')}\n\nOriginal notes: ${stockRequest?.notes || 'None'}`
          })
          .eq('id', stockRequestId);

        if (updateError) {
          console.error('Error creating amendment request:', updateError);
          throw updateError;
        }

        // Update stock request lines
        const { error: deleteError } = await supabase
          .from('stock_request_lines')
          .delete()
          .eq('request_id', stockRequestId);

        if (deleteError) {
          console.error('Error deleting old lines:', deleteError);
          throw deleteError;
        }

        const { error: insertError } = await supabase
          .from('stock_request_lines')
          .insert(validItems.map(item => ({
            request_id: stockRequestId,
            item_id: item.item_id,
            qty: item.quantity,
            notes: item.notes
          })));

        if (insertError) {
          console.error('Error inserting new lines:', insertError);
          throw insertError;
        }

        console.log('Amendment request created successfully');
      }

      onClose();
    } catch (error) {
      console.error('Error submitting amendment:', error);
    }
  };

  if (poLoading || srLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!stockRequest) {
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
            {purchaseOrder ? `Amend Purchase Order - ${purchaseOrder.po_number}` : 'Report Stock Issues'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-blue-700">
            {purchaseOrder 
              ? 'This will update the existing purchase order with corrected quantities and any additional items needed.'
              : 'Report discrepancies in the originally requested items or request additional items. This will create an amendment request for the office to process.'
            }
            The office will be notified of these changes.
          </p>
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

          {amendmentItems.map((item) => (
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
                </div>

                <div className="col-span-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                  />
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
          ))}

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
            disabled={amendPO.isPending || !amendmentReason.trim() || amendmentItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {amendPO.isPending 
              ? 'Submitting...' 
              : purchaseOrder 
                ? 'Amend Purchase Order'
                : 'Submit Amendment Request'
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
            {amendPO.isPending ? 'Submitting...' : 'Confirm Amendment'}
          </Button>
        </div>
      )}
    </div>
  );
};