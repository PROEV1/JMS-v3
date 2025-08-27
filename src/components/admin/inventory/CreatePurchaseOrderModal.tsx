import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreatePurchaseOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface POItem {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
}

export function CreatePurchaseOrderModal({ open, onOpenChange }: CreatePurchaseOrderModalProps) {
  const [supplierId, setSupplierId] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [poItems, setPoItems] = useState<POItem[]>([
    { id: "1", item_id: "", item_name: "", quantity: 1, unit_cost: 0 }
  ]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_suppliers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch inventory items
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const addItem = () => {
    setPoItems([...poItems, { 
      id: Date.now().toString(), 
      item_id: "", 
      item_name: "", 
      quantity: 1, 
      unit_cost: 0 
    }]);
  };

  const removeItem = (id: string) => {
    setPoItems(poItems.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof POItem, value: any) => {
    setPoItems(poItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const totalAmount = poItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplierId || poItems.some(item => !item.item_id || !item.quantity)) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create the purchase order with auto-generated PO number (handled by database trigger)
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: '', // Will be replaced by database trigger
          supplier_id: supplierId,
          expected_delivery_date: expectedDelivery || null,
          notes,
          total_amount: totalAmount,
          status: 'pending' as const
        })
        .select()
        .single();

      if (poError) throw poError;

      // Create purchase order lines
      const poLines = poItems
        .filter(item => item.item_id && item.quantity > 0)
        .map(item => ({
          purchase_order_id: poData.id,
          item_id: item.item_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_cost: item.quantity * item.unit_cost
        }));

      if (poLines.length > 0) {
        const { error: linesError } = await supabase
          .from('purchase_order_lines')
          .insert(poLines);

        if (linesError) throw linesError;
      }
      
      toast({
        title: "Success",
        description: `Purchase order ${poData.po_number} created successfully`,
      });

      // Refresh the purchase orders list
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-metrics'] });

      onOpenChange(false);
      // Reset form
      setSupplierId("");
      setExpectedDelivery("");
      setNotes("");
      setPoItems([{ id: "1", item_id: "", item_name: "", quantity: 1, unit_cost: 0 }]);
    } catch (error: any) {
      console.error("Error creating purchase order:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase order",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected-delivery">Expected Delivery</Label>
              <Input
                id="expected-delivery"
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {poItems.map((item, index) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-4">
                      <Label>Item</Label>
                      <Select 
                        value={item.item_id} 
                        onValueChange={(value) => {
                          updateItem(item.id, "item_id", value);
                          // Auto-populate name based on selection
                          const selectedItem = inventoryItems.find(i => i.id === value);
                          if (selectedItem) {
                            updateItem(item.id, "item_name", selectedItem.name);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map(inventoryItem => (
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
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value))}
                        min="1"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Unit Cost</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(item.id, "unit_cost", parseFloat(e.target.value))}
                        min="0"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Total</Label>
                      <div className="h-10 flex items-center px-3 border rounded bg-muted">
                        £{(item.quantity * item.unit_cost).toFixed(2)}
                      </div>
                    </div>

                    <div className="col-span-2">
                      {poItems.length > 1 && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="text-right">
              <p className="text-lg font-semibold">Total: £{totalAmount.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for this purchase order"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Create Purchase Order
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}