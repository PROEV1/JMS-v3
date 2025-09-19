import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface MarkAsDispatchedModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
}

export function MarkAsDispatchedModal({ isOpen, onClose, orderId }: MarkAsDispatchedModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    dispatchedDate: format(new Date(), 'yyyy-MM-dd'),
    courierName: '',
    trackingNumber: '',
    sentFrom: 'warehouse',
    notes: ''
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error('No order ID provided');
      
      // Get or create a default charger item for this dispatch
      // In practice, this would be selected by the user, but for now we'll use a default
      let { data: chargerItems, error: chargerItemError } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('is_charger', true)
        .limit(1);

      if (chargerItemError) throw chargerItemError;
      
      const chargerItemId = chargerItems?.[0]?.id;
      if (!chargerItemId) {
        throw new Error('No charger items found in inventory');
      }

      // Create or update charger dispatch record
      const { error } = await supabase
        .from('charger_dispatches')
        .upsert({
          order_id: orderId,
          charger_item_id: chargerItemId,
          status: 'sent', // Use 'sent' instead of 'dispatched' to match DB constraint
          dispatched_at: new Date(formData.dispatchedDate + 'T12:00:00Z').toISOString(),
          dispatched_by: user?.id, // Capture who marked as dispatched
          tracking_number: formData.trackingNumber || null,
          notes: `Courier: ${formData.courierName}\nSent from: ${formData.sentFrom}\n${formData.notes}`.trim(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Order marked as dispatched successfully');
      queryClient.invalidateQueries({ queryKey: ['charger-dispatch-data'] });
      onClose();
      resetForm();
    },
    onError: (error) => {
      console.error('Error marking as dispatched:', error);
      toast.error('Failed to mark order as dispatched');
    }
  });

  const resetForm = () => {
    setFormData({
      dispatchedDate: format(new Date(), 'yyyy-MM-dd'),
      courierName: '',
      trackingNumber: '',
      sentFrom: 'warehouse',
      notes: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.courierName.trim()) {
      toast.error('Courier name is required');
      return;
    }

    dispatchMutation.mutate();
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Mark as Dispatched</DialogTitle>
          <DialogDescription>
            Record the dispatch details for this order's charger
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dispatchedDate">Date Dispatched</Label>
              <Input
                id="dispatchedDate"
                type="date"
                value={formData.dispatchedDate}
                onChange={(e) => setFormData({ ...formData, dispatchedDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sentFrom">Sent From</Label>
              <Select
                value={formData.sentFrom}
                onValueChange={(value) => setFormData({ ...formData, sentFrom: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="van_stock">Van Stock</SelectItem>
                  <SelectItem value="drop_ship">Drop-ship</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="courierName">Courier Name *</Label>
            <Input
              id="courierName"
              placeholder="e.g., DPD, Royal Mail, UPS..."
              value={formData.courierName}
              onChange={(e) => setFormData({ ...formData, courierName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trackingNumber">Tracking Number</Label>
            <Input
              id="trackingNumber"
              placeholder="Enter tracking number (optional)"
              value={formData.trackingNumber}
              onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about the dispatch..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={dispatchMutation.isPending}
            >
              {dispatchMutation.isPending ? 'Saving...' : 'Mark as Dispatched'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}