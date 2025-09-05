import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, Package, Save } from 'lucide-react';

interface RmaUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rma: any;
}

export function RmaUpdateModal({ open, onOpenChange, rma }: RmaUpdateModalProps) {
  const [status, setStatus] = useState(rma?.status || '');
  const [returnDate, setReturnDate] = useState(rma?.return_date || '');
  const [replacementExpectedDate, setReplacementExpectedDate] = useState(rma?.replacement_expected_date || '');
  const [replacementReceivedDate, setReplacementReceivedDate] = useState(rma?.replacement_received_date || '');
  const [replacementSerialNumber, setReplacementSerialNumber] = useState(rma?.replacement_serial_number || '');
  const [notes, setNotes] = useState(rma?.notes || '');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateRmaMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from('returns_rmas')
        .update(updates)
        .eq('id', rma.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "RMA Updated Successfully",
        description: `Updated RMA ${rma.rma_number}`,
      });
      queryClient.invalidateQueries({ queryKey: ['returns-rmas'] });
      queryClient.invalidateQueries({ queryKey: ['rma-metrics'] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating RMA:', error);
      toast({
        title: "Error Updating RMA",
        description: "Failed to update RMA. Please try again.",
        variant: "destructive"
      });
    }
  });

    const handleUpdate = () => {
    const updates: any = {
      status: status as any,
      notes,
      updated_at: new Date().toISOString()
    };

    if (returnDate) updates.return_date = returnDate;
    if (replacementExpectedDate) updates.replacement_expected_date = replacementExpectedDate;
    if (replacementReceivedDate) updates.replacement_received_date = replacementReceivedDate;
    if (replacementSerialNumber) updates.replacement_serial_number = replacementSerialNumber;

    updateRmaMutation.mutate(updates);
  };

  if (!rma) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Update RMA - {rma.rma_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending_return">Pending Return</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="received_by_supplier">Received</SelectItem>
                <SelectItem value="replacement_sent">Replacement Sent</SelectItem>
                <SelectItem value="replacement_received">Replacement Received</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Return Date */}
          <div className="space-y-2">
            <Label htmlFor="return_date">Return Date</Label>
            <Input
              id="return_date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>

          {/* Replacement Expected Date */}
          <div className="space-y-2">
            <Label htmlFor="replacement_expected_date">Expected Replacement Date</Label>
            <Input
              id="replacement_expected_date"
              type="date"
              value={replacementExpectedDate}
              onChange={(e) => setReplacementExpectedDate(e.target.value)}
            />
          </div>

          {/* Replacement Received Date */}
          <div className="space-y-2">
            <Label htmlFor="replacement_received_date">Replacement Received Date</Label>
            <Input
              id="replacement_received_date"
              type="date"
              value={replacementReceivedDate}
              onChange={(e) => setReplacementReceivedDate(e.target.value)}
            />
          </div>

          {/* Replacement Serial Number */}
          <div className="space-y-2">
            <Label htmlFor="replacement_serial">Replacement Serial Number</Label>
            <Input
              id="replacement_serial"
              value={replacementSerialNumber}
              onChange={(e) => setReplacementSerialNumber(e.target.value)}
              placeholder="Enter replacement serial number"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          <Button 
            onClick={handleUpdate} 
            className="w-full"
            disabled={updateRmaMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateRmaMutation.isPending ? 'Updating...' : 'Update RMA'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}