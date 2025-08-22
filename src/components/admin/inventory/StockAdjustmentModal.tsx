import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Wrench } from 'lucide-react';

interface StockAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockAdjustmentModal({ open, onOpenChange }: StockAdjustmentModalProps) {
  const [selectedItem, setSelectedItem] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch items
  const { data: items } = useQuery({
    queryKey: ['inventory-items-for-adjustment'],
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, sku')
        .eq('is_active', true);
      return data || [];
    }
  });

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_locations')
        .select('id, name, type')
        .eq('is_active', true);
      return data || [];
    }
  });

  // Adjustment mutation
  const adjustmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem || !selectedLocation || !quantity || !reason) {
        throw new Error('All fields are required');
      }

      const adjustQty = parseInt(quantity);
      if (adjustQty <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      const direction = adjustmentType === 'add' ? 'in' : 'out';
      const reference = `Stock adjustment - ${reason}`;

      const { error } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: selectedItem,
          location_id: selectedLocation,
          direction: 'adjust', // Special direction for adjustments
          qty: adjustmentType === 'add' ? adjustQty : -adjustQty,
          reference,
          notes
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Stock adjusted successfully",
        description: `${adjustmentType === 'add' ? 'Added' : 'Removed'} ${quantity} units`
      });
      queryClient.invalidateQueries({ queryKey: ['inventory-kpi-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Adjustment failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleClose = () => {
    setSelectedItem('');
    setSelectedLocation('');
    setAdjustmentType('add');
    setQuantity('');
    setReason('');
    setNotes('');
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adjustmentMutation.mutate();
  };

  const reasonOptions = [
    'Stock count correction',
    'Damaged goods write-off',
    'Found inventory',
    'Shrinkage',
    'System error correction',
    'Other'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Stock Adjustment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item">Item</Label>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger>
                <SelectValue placeholder="Select item to adjust" />
              </SelectTrigger>
              <SelectContent>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name} ({location.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={(value: 'add' | 'subtract') => setAdjustmentType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Stock</SelectItem>
                  <SelectItem value="subtract">Remove Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason for adjustment" />
              </SelectTrigger>
              <SelectContent>
                {reasonOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={adjustmentMutation.isPending || !selectedItem || !selectedLocation || !quantity || !reason}
            >
              {adjustmentMutation.isPending ? 'Processing...' : 'Apply Adjustment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}