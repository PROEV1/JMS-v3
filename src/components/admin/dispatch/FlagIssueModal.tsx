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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FlagIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
}

export function FlagIssueModal({ isOpen, onClose, orderId }: FlagIssueModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    issueType: '',
    description: ''
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error('No order ID provided');
      
      // Get or create a default charger item for this dispatch
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

      // Create or update charger dispatch record with issue status
      const { error } = await supabase
        .from('charger_dispatches')
        .upsert({
          order_id: orderId,
          charger_item_id: chargerItemId,
          status: 'issue',
          notes: `Issue Type: ${formData.issueType}\n\nDescription: ${formData.description}`,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Issue flagged successfully');
      queryClient.invalidateQueries({ queryKey: ['charger-dispatch-data'] });
      onClose();
      resetForm();
    },
    onError: (error) => {
      console.error('Error flagging issue:', error);
      toast.error('Failed to flag issue');
    }
  });

  const resetForm = () => {
    setFormData({
      issueType: '',
      description: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.issueType.trim() || !formData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    issueMutation.mutate();
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const issueTypes = [
    'Address Issue',
    'Client Unavailable',
    'Missing Parts',
    'Courier Problem',
    'Damage in Transit',
    'Wrong Item Sent',
    'Access Issues',
    'Other'
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Flag Dispatch Issue</DialogTitle>
          <DialogDescription>
            Report an issue with this order's charger dispatch
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="issueType">Issue Type *</Label>
            <Select
              value={formData.issueType}
              onValueChange={(value) => setFormData({ ...formData, issueType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an issue type" />
              </SelectTrigger>
              <SelectContent>
                {issueTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              disabled={issueMutation.isPending}
            >
              {issueMutation.isPending ? 'Flagging...' : 'Flag Issue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}