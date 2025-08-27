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
import { useCreateStockRequest } from '@/hooks/useStockRequests';

interface CreateStockRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RequestLine {
  id: string;
  item_id: string;
  qty: number;
  notes?: string;
}

export function CreateStockRequestModal({ open, onOpenChange }: CreateStockRequestModalProps) {
  const [engineerId, setEngineerId] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<RequestLine[]>([
    { id: '1', item_id: '', qty: 1, notes: '' }
  ]);

  const { toast } = useToast();
  const createRequest = useCreateStockRequest();

  // Fetch engineers
  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name, type')
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
    setLines([...lines, { id: Date.now().toString(), item_id: '', qty: 1, notes: '' }]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter(line => line.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof RequestLine, value: any) => {
    setLines(lines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!engineerId || !destinationLocationId || lines.some(line => !line.item_id || !line.qty)) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const requestData = {
        destination_location_id: destinationLocationId,
        order_id: orderId || null,
        needed_by: neededBy || null,
        priority,
        notes: notes || '',
        lines: lines.map(({ id, ...line }) => line),
        engineer_id: engineerId
      };

      console.log('Creating stock request:', requestData);
      await createRequest.mutateAsync(requestData);

      onOpenChange(false);
      // Reset form
      setEngineerId('');
      setDestinationLocationId('');
      setOrderId('');
      setNeededBy('');
      setPriority('medium');
      setNotes('');
      setLines([{ id: '1', item_id: '', qty: 1, notes: '' }]);
    } catch (error) {
      console.error('Failed to create stock request:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Request</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="engineer">Engineer *</Label>
              <Select value={engineerId} onValueChange={setEngineerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select engineer" />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map(engineer => (
                    <SelectItem key={engineer.id} value={engineer.id}>
                      {engineer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Destination Location *</Label>
              <Select value={destinationLocationId} onValueChange={setDestinationLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order">Order ID (Optional)</Label>
              <Input
                id="order"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="ORD2024-0001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="needed-by">Needed By</Label>
              <Input
                id="needed-by"
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                    <div className="col-span-5">
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

                    <div className="col-span-4">
                      <Label>Notes</Label>
                      <Input
                        value={line.notes || ''}
                        onChange={(e) => updateLine(line.id, 'notes', e.target.value)}
                        placeholder="Optional notes"
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
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for this request"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Create Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}