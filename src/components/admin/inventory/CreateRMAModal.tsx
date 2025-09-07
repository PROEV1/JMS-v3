import React, { useState, useEffect } from 'react';
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
  item_name?: string; // For custom typed items
  item_type: 'inventory' | 'charger';
  qty: number;
  reason: string;
  condition: string;
}

export function CreateRMAModal({ open, onOpenChange }: CreateRMAModalProps) {
  const [rmaNumber, setRmaNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [rmaType, setRmaType] = useState<'return' | 'warranty' | 'exchange'>('return');
  const [originalOrderId, setOriginalOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<RMALine[]>([
    { id: '1', item_id: '', item_name: '', item_type: 'inventory', qty: 1, reason: '', condition: 'damaged' }
  ]);

  const { toast } = useToast();

  // Generate RMA number when modal opens
  useEffect(() => {
    if (open && !rmaNumber) {
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 9000) + 1000;
      setRmaNumber(`RMA${year}-${randomNum}`);
    }
  }, [open, rmaNumber]);

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

  // Fetch inventory items (non-chargers)
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory-items-non-chargers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku')
        .eq('is_active', true)
        .eq('is_charger', false)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch chargers
  const { data: chargers = [] } = useQuery({
    queryKey: ['charger-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charger_inventory')
        .select(`
          id,
          serial_number,
          charger_item_id,
          inventory_items(name, sku)
        `)
        .eq('status', 'available')
        .order('serial_number');
      if (error) throw error;
      return data;
    }
  });

  const addLine = () => {
    setLines([...lines, { 
      id: Date.now().toString(), 
      item_id: '', 
      item_name: '',
      item_type: 'inventory',
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
    console.log(`Updating line ${id}, field ${field}, value:`, value);
    setLines(prevLines => {
      const newLines = prevLines.map(line => 
        line.id === id ? { ...line, [field]: value } : line
      );
      console.log('New lines state:', newLines);
      return newLines;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Debug logging
    console.log('Form submission - RMA Number:', rmaNumber);
    console.log('Form submission - Supplier ID:', supplierId);
    console.log('Form submission - Reason:', reason);
    console.log('Form submission - Lines:', lines);
    
    // Check each line individually
    lines.forEach((line, index) => {
      console.log(`Line ${index}:`, {
        id: line.id,
        item_id: line.item_id,
        qty: line.qty,
        reason: line.reason,
        hasAllRequired: !(!line.item_id || !line.qty || !line.reason)
      });
    });
    
    if (!rmaNumber || !supplierId || !reason || lines.some(line => (!line.item_id && !line.item_name) || !line.qty || !line.reason)) {
      const missingFields = [];
      if (!rmaNumber) missingFields.push('RMA Number');
      if (!supplierId) missingFields.push('Supplier');
      if (!reason) missingFields.push('Overall Reason');
      
      lines.forEach((line, index) => {
        if (!line.item_id && !line.item_name) missingFields.push(`Line ${index + 1}: Item`);
        if (!line.qty) missingFields.push(`Line ${index + 1}: Quantity`);
        if (!line.reason) missingFields.push(`Line ${index + 1}: Reason`);
      });
      
      console.log('Missing required fields:', missingFields);
      
      toast({
        title: 'Error',
        description: `Please fill in all required fields: ${missingFields.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      
      // Create one RMA record per item/quantity
      const rmaRecords = [];
      for (const line of lines) {
        // For quantities > 1, create multiple records
        for (let i = 0; i < line.qty; i++) {
          const recordNumber = lines.length > 1 || line.qty > 1 
            ? `${rmaNumber}-${String(rmaRecords.length + 1).padStart(2, '0')}` 
            : rmaNumber;
            
          rmaRecords.push({
            rma_number: recordNumber,
            item_id: line.item_id || null, // Use null if custom item
            custom_item_name: line.item_id ? null : line.item_name, // Store custom name if no item_id
            supplier_id: supplierId,
            return_reason: `${reason} - ${line.reason} (${line.condition})`,
            notes: `Type: ${line.item_type}, Condition: ${line.condition}, Item: ${line.item_name || 'Selected from inventory'}`,
            created_by: currentUser?.id
          });
        }
      }

      const { error: insertError } = await supabase
        .from('returns_rmas')
        .insert(rmaRecords);

      if (insertError) throw insertError;
      
      toast({
        title: 'Success',
        description: `${rmaRecords.length} RMA record(s) created successfully`,
      });

      onOpenChange(false);
      // Reset form
      setRmaNumber('');
      setSupplierId('');
      setRmaType('return');
      setOriginalOrderId('');
      setReason('');
      setLines([{ id: '1', item_id: '', item_name: '', item_type: 'inventory', qty: 1, reason: '', condition: 'damaged' }]);
    } catch (error) {
      console.error('Error creating RMA:', error);
      toast({
        title: 'Error',
        description: 'Failed to create RMA. Please try again.',
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
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rma-number">RMA Number *</Label>
              <Input
                id="rma-number"
                value={rmaNumber}
                onChange={(e) => setRmaNumber(e.target.value)}
                placeholder="RMA2024-0001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent className="z-[60] bg-background border shadow-lg">
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
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60] bg-background border shadow-lg">
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
                    <div className="col-span-2">
                      <Label>Type</Label>
                      <Select 
                        key={`type-${line.id}-${line.item_type}`}
                        value={line.item_type || 'inventory'} 
                        onValueChange={(value: 'inventory' | 'charger') => {
                          console.log('Type changing from', line.item_type, 'to', value, 'for line', line.id);
                          updateLine(line.id, 'item_type', value);
                          updateLine(line.id, 'item_id', ''); // Reset item selection
                        }}
                      >
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-popover border shadow-lg" position="popper" side="bottom" align="start">
                          <SelectItem value="inventory" className="cursor-pointer hover:bg-accent">Inventory</SelectItem>
                          <SelectItem value="charger" className="cursor-pointer hover:bg-accent">Charger</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                     <div className="col-span-3">
                       <Label>Item</Label>
                       <div className="space-y-2">
                         {/* Custom item input */}
                         <div className="space-y-1">
                           <Input
                             value={line.item_name || ''}
                             onChange={(e) => {
                               const value = e.target.value;
                               updateLine(line.id, 'item_name', value);
                               updateLine(line.id, 'item_id', ''); // Clear item_id when typing custom
                             }}
                             placeholder="Type custom part name..."
                             className="text-sm"
                           />
                           <p className="text-xs text-muted-foreground">Or select from inventory below:</p>
                         </div>
                         
                         {/* Inventory dropdown */}
                         <Select 
                           value={line.item_id} 
                           onValueChange={(value) => {
                             updateLine(line.id, 'item_id', value);
                             // Find the selected item and set its name
                             if (line.item_type === 'inventory') {
                               const selectedItem = inventoryItems.find(item => item.id === value);
                               if (selectedItem) {
                                 updateLine(line.id, 'item_name', `${selectedItem.name} (${selectedItem.sku})`);
                               }
                             } else {
                               const selectedCharger = chargers.find(charger => charger.id === value);
                               if (selectedCharger) {
                                 updateLine(line.id, 'item_name', `${selectedCharger.inventory_items?.name} - ${selectedCharger.serial_number}`);
                               }
                             }
                           }}
                         >
                           <SelectTrigger className="bg-background text-sm">
                             <SelectValue placeholder="Select from inventory..." />
                           </SelectTrigger>
                           <SelectContent className="z-[60] bg-background border shadow-lg max-h-[200px]">
                             {line.item_type === 'inventory' 
                               ? inventoryItems.map(item => (
                                   <SelectItem key={item.id} value={item.id}>
                                     {item.name} ({item.sku})
                                   </SelectItem>
                                 ))
                               : chargers.map(charger => (
                                   <SelectItem key={charger.id} value={charger.id}>
                                     {charger.inventory_items?.name} - {charger.serial_number}
                                   </SelectItem>
                                 ))
                             }
                           </SelectContent>
                         </Select>
                       </div>
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
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[60] bg-background border shadow-lg">
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="defective">Defective</SelectItem>
                          <SelectItem value="wrong_item">Wrong Item</SelectItem>
                          <SelectItem value="excess">Excess</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-3">
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