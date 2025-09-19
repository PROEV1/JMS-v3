import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Package, Truck, PoundSterling } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currency';

interface PartsOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  partDetails?: string | null;
  onSuccess?: () => void;
}

interface PartItem {
  id: string;
  description: string;
  quantity: number;
  unit_cost: number;
}

export function PartsOrderModal({ 
  open, 
  onOpenChange, 
  orderId, 
  partDetails, 
  onSuccess 
}: PartsOrderModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [netCost, setNetCost] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [partItems, setPartItems] = useState<PartItem[]>([
    { id: '1', description: partDetails || '', quantity: 1, unit_cost: 0 }
  ]);

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_suppliers')
        .select('id, name, contact_name, contact_email, contact_phone')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const addPartItem = () => {
    setPartItems(prev => [
      ...prev,
      { id: Date.now().toString(), description: '', quantity: 1, unit_cost: 0 }
    ]);
  };

  const removePartItem = (id: string) => {
    setPartItems(prev => prev.filter(item => item.id !== id));
  };

  const updatePartItem = (id: string, field: keyof PartItem, value: any) => {
    setPartItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotalCost = () => {
    return partItems.reduce((total, item) => total + (item.quantity * item.unit_cost), 0);
  };

  // Watch for changes to make calculated total reactive
  const calculatedTotal = calculateTotalCost();
  
  // Automatically update netCost when calculatedTotal changes
  useEffect(() => {
    if (calculatedTotal > 0) {
      setNetCost(calculatedTotal.toFixed(2));
    }
  }, [calculatedTotal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplierId || !orderNumber || !netCost) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const user = await supabase.auth.getUser();
      
      // Step 1: Create the official Purchase Order
      const filteredItems = partItems.filter(item => item.description.trim());
      const poData = {
        po_number: `PO${new Date().getFullYear()}-${orderNumber}`,
        supplier_id: supplierId,
        expected_delivery_date: expectedDeliveryDate || null,
        notes: notes || null,
        total_amount: parseFloat(netCost),
        status: 'pending' as const,
        source_order_id: orderId,
        created_by: user.data.user?.id
      };

      const { data: purchaseOrder, error: poError } = await supabase
        .from('purchase_orders')
        .insert(poData)
        .select()
        .single();

      if (poError) throw poError;

      // Step 2: Create purchase order lines
      const poLines = filteredItems.map(item => ({
        purchase_order_id: purchaseOrder.id,
        item_id: null, // Custom items for now
        item_name: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost
      }));

      if (poLines.length > 0) {
        const { error: linesError } = await supabase
          .from('purchase_order_lines')
          .insert(poLines);

        if (linesError) throw linesError;
      }

      // Step 3: Create the order_parts record linked to the PO
      const { error: partError } = await supabase
        .from('order_parts')
        .insert({
          order_id: orderId,
          supplier_id: supplierId,
          order_number: orderNumber,
          net_cost: parseFloat(netCost),
          items_ordered: filteredItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unit_cost: item.unit_cost
          })) as any,
          expected_delivery_date: expectedDeliveryDate || null,
          notes: notes || null,
          purchase_order_id: purchaseOrder.id,
          created_by: user.data.user?.id
        });

      if (partError) throw partError;

      // Step 4: Update the order to mark parts as ordered
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          parts_ordered: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      toast({
        title: "Success",
        description: `Parts order created successfully. Purchase Order ${purchaseOrder.po_number} has been generated.`,
      });

      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      setSupplierId('');
      setOrderNumber('');
      setNetCost('');
      setExpectedDeliveryDate('');
      setNotes('');
      setPartItems([{ id: '1', description: partDetails || '', quantity: 1, unit_cost: 0 }]);
      
    } catch (error) {
      console.error('Error creating parts order:', error);
      toast({
        title: "Error",
        description: "Failed to create parts order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Parts
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="orderNumber">Order/Reference Number *</Label>
              <Input
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Enter supplier order number"
                required
              />
            </div>
          </div>

          {/* Supplier Contact Info */}
          {selectedSupplier && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Supplier Contact Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {selectedSupplier.contact_name && (
                    <div>
                      <span className="font-medium">Contact:</span>
                      <div>{selectedSupplier.contact_name}</div>
                    </div>
                  )}
                  {selectedSupplier.contact_email && (
                    <div>
                      <span className="font-medium">Email:</span>
                      <div>{selectedSupplier.contact_email}</div>
                    </div>
                  )}
                  {selectedSupplier.contact_phone && (
                    <div>
                      <span className="font-medium">Phone:</span>
                      <div>{selectedSupplier.contact_phone}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parts Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Parts Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPartItem}>
                Add Item
              </Button>
            </div>
            
            <div className="space-y-3">
              {partItems.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor={`desc-${item.id}`}>Description</Label>
                      <Input
                        id={`desc-${item.id}`}
                        value={item.description}
                        onChange={(e) => updatePartItem(item.id, 'description', e.target.value)}
                        placeholder="Part description"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`qty-${item.id}`}>Quantity</Label>
                      <Input
                        id={`qty-${item.id}`}
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updatePartItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        min="1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`cost-${item.id}`}>Unit Cost (£)</Label>
                        <Input
                          id={`cost-${item.id}`}
                          type="number"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updatePartItem(item.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                          min="0"
                        />
                      </div>
                      {partItems.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removePartItem(item.id)}
                          className="mt-6"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Cost Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="netCost">Total Net Cost (ex. VAT) *</Label>
              <div className="relative">
                <PoundSterling className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="netCost"
                  type="number"
                  step="0.01"
                  value={netCost}
                  onChange={(e) => setNetCost(e.target.value)}
                  placeholder="0.00"
                  className="pl-10"
                  required
                  readOnly
                />
              </div>
              <div className="text-sm text-success-foreground mt-1">
                Automatically calculated from items: {formatCurrency(calculatedTotal)}
                {calculatedTotal !== parseFloat(netCost || '0') && parseFloat(netCost || '0') > 0 && (
                  <span className="text-amber-600 ml-2">
                    (Manual override detected)
                  </span>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="expectedDelivery">Expected Delivery Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="expectedDelivery"
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this parts order..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Order...' : 'Create Parts Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}