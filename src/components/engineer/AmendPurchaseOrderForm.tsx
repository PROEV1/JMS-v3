import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Package, Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePurchaseOrderForStockRequest, useAmendPurchaseOrder } from '@/hooks/usePurchaseOrderAmendment';

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
  
  const amendPO = useAmendPurchaseOrder();
  
  // Get the PO linked to this stock request
  const { data: purchaseOrder, isLoading: poLoading } = usePurchaseOrderForStockRequest(stockRequestId);
  
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

  // Pre-populate with current PO items
  useEffect(() => {
    if (purchaseOrder?.purchase_order_lines) {
      const items = purchaseOrder.purchase_order_lines.map((line, index) => ({
        id: `existing-${index}`,
        item_id: line.item_id,
        item_name: line.item.name,
        quantity: line.quantity,
        notes: ''
      }));
      setAmendmentItems(items);
    }
  }, [purchaseOrder]);

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

  const handleSubmit = async () => {
    if (!purchaseOrder || !amendmentReason.trim()) {
      return;
    }

    const validItems = amendmentItems.filter(item => 
      item.item_id && item.quantity > 0
    );

    if (validItems.length === 0) {
      return;
    }

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

    onClose();
  };

  if (poLoading) {
    return <div className="p-4">Loading purchase order...</div>;
  }

  if (!purchaseOrder) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            <span>No purchase order found for this stock request. A PO must be created first before reporting issues.</span>
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
            Amend Purchase Order - {purchaseOrder.po_number}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-blue-700">
            This will update the existing purchase order with corrected quantities and any additional items needed.
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

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={amendPO.isPending || !amendmentReason.trim() || amendmentItems.length === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {amendPO.isPending ? 'Amending PO...' : 'Amend Purchase Order'}
        </Button>
      </div>
    </div>
  );
};