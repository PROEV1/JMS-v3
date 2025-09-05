import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Package } from 'lucide-react';

interface RmaShipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rma: any;
}

export function RmaShipModal({ open, onOpenChange, rma }: RmaShipModalProps) {
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notes, setNotes] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const shipRmaMutation = useMutation({
    mutationFn: async () => {
      const updates = {
        status: 'in_transit' as const,
        return_date: returnDate,
        notes: notes ? `${rma.notes || ''}\n\nShipping Info:\nCarrier: ${carrier}\nTracking: ${trackingNumber}\nNotes: ${notes}`.trim() : rma.notes,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('returns_rmas')
        .update(updates)
        .eq('id', rma.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "RMA Shipped Successfully",
        description: `RMA ${rma.rma_number} has been marked as shipped`,
      });
      queryClient.invalidateQueries({ queryKey: ['returns-rmas'] });
      queryClient.invalidateQueries({ queryKey: ['rma-metrics'] });
      onOpenChange(false);
      
      // Reset form
      setTrackingNumber('');
      setCarrier('');
      setNotes('');
    },
    onError: (error) => {
      console.error('Error shipping RMA:', error);
      toast({
        title: "Error Shipping RMA",
        description: "Failed to ship RMA. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleShip = () => {
    if (!returnDate) {
      toast({
        title: "Return date required",
        description: "Please select a return date",
        variant: "destructive"
      });
      return;
    }

    shipRmaMutation.mutate();
  };

  if (!rma) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Ship Return - {rma.rma_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Info */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4" />
              <span className="font-medium">Item Details</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {rma.inventory_items?.name} ({rma.inventory_items?.sku})
            </p>
            <p className="text-sm text-muted-foreground">
              Reason: {rma.return_reason}
            </p>
          </div>

          {/* Return Date */}
          <div className="space-y-2">
            <Label htmlFor="return_date">Return Date *</Label>
            <Input
              id="return_date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
            />
          </div>

          {/* Carrier */}
          <div className="space-y-2">
            <Label htmlFor="carrier">Carrier</Label>
            <Input
              id="carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="e.g., DPD, Royal Mail, UPS"
            />
          </div>

          {/* Tracking Number */}
          <div className="space-y-2">
            <Label htmlFor="tracking">Tracking Number</Label>
            <Input
              id="tracking"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking number"
            />
          </div>

          {/* Shipping Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Shipping Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional shipping notes..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleShip} 
              className="flex-1"
              disabled={shipRmaMutation.isPending}
            >
              <Truck className="h-4 w-4 mr-2" />
              {shipRmaMutation.isPending ? 'Shipping...' : 'Ship Return'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}