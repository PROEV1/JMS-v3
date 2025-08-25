import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CreateRMAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RMALine {
  id: string;
  item_id: string;
  qty: number;
  reason: string;
  condition: string;
}

export function CreateRMAModal({ open, onOpenChange }: CreateRMAModalProps) {
  const [supplierId, setSupplierId] = useState('');
  const [rmaType, setRmaType] = useState<'return' | 'warranty' | 'exchange'>('return');
  const [originalOrderId, setOriginalOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<RMALine[]>([
    { id: '1', item_id: '', qty: 1, reason: '', condition: 'damaged' }
  ]);

  const { toast } = useToast();

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
  const { data: items = [] } = useQuery({
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

  const addLine = () => {
    setLines([...lines, { 
      id: Date.now().toString(), 
      item_id: '', 
      qty: 1, 
      reason: '', 
      condition: 'damaged' 
    }]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter(line => line.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof RMALine, value: any) => {
    setLines(lines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplierId || lines.some(line => !line.item_id || !line.qty || !line.reason)) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const rmaData = {
        supplier_id: supplierId,
        rma_type: rmaType,
        original_order_id: originalOrderId || undefined,
        reason,
        lines: lines.map(({ id, ...line }) => line)
      };

      // TODO: Implement actual RMA creation
      console.log('Creating RMA:', rmaData);
      
      toast({
        title: 'Success',
        description: 'RMA created successfully',
      });

      onOpenChange(false);
      // Reset form
      setSupplierId('');
      setRmaType('return');
      setOriginalOrderId('');
      setReason('');
      setLines([{ id: '1', item_id: '', qty: 1, reason: '', condition: 'damaged' }]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create RMA',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Return/RMA</DialogTitle>
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
              <Label htmlFor="type">RMA Type *</Label>
              <Select value={rmaType} onValueChange={(value: 'return' | 'warranty' | 'exchange') => setRmaType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="warranty">Warranty</SelectItem>
                  <SelectItem value="exchange">Exchange</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="original-order">Original Purchase Order (Optional)</Label>
            <Input
              id="original-order"
              value={originalOrderId}
              onChange={(e) => setOriginalOrderId(e.target.value)}
              placeholder="PO2024-0001"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {lines.map((line) => (
              <Card key={line.id}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-3">
                      <Label>Item</Label>
                      <Select 
                        value={line.item_id} 
                        onValueChange={(value) => updateLine(line.id, 'item_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} ({item.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={line.qty}
                        onChange={(e) => updateLine(line.id, 'qty', parseInt(e.target.value))}
                        min="1"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Condition</Label>
                      <Select 
                        value={line.condition} 
                        onValueChange={(value) => updateLine(line.id, 'condition', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="defective">Defective</SelectItem>
                          <SelectItem value="wrong_item">Wrong Item</SelectItem>
                          <SelectItem value="excess">Excess</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-4">
                      <Label>Reason</Label>
                      <Input
                        value={line.reason}
                        onChange={(e) => updateLine(line.id, 'reason', e.target.value)}
                        placeholder="Reason for return"
                      />
                    </div>

                    <div className="col-span-1">
                      {lines.length > 1 && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Overall Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Overall reason for this RMA"
              rows={3}
              required
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Create RMA
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}