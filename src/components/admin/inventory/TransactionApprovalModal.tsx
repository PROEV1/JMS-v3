import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showErrorToast, showSuccessToast } from '@/utils/apiErrorHandler';

interface TransactionApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  onSuccess?: () => void;
}

export const TransactionApprovalModal: React.FC<TransactionApprovalModalProps> = ({
  open,
  onOpenChange,
  transaction,
  onSuccess
}) => {
  const [reason, setReason] = React.useState('');
  const queryClient = useQueryClient();

  const approveTransaction = useMutation({
    mutationFn: async ({ action, reason }: { action: 'approve' | 'reject'; reason?: string }) => {
      const { data, error } = await supabase.rpc('approve_inventory_transaction', {
        p_txn_id: transaction.id,
        p_action: action,
        p_reason: reason || null
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-audit'] });
      showSuccessToast('Transaction status updated successfully');
      onSuccess?.();
      setReason('');
    },
    onError: (error) => {
      console.error('Failed to update transaction status:', error);
      showErrorToast('Failed to update transaction status');
    }
  });

  const handleApprove = () => {
    approveTransaction.mutate({ action: 'approve', reason });
  };

  const handleReject = () => {
    if (!reason.trim()) {
      showErrorToast('Please provide a reason for rejection');
      return;
    }
    approveTransaction.mutate({ action: 'reject', reason });
  };

  if (!transaction) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transaction Approval</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Info */}
          <div className="p-4 bg-muted/30 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Item:</span>
              <span>{transaction.inventory_items?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Location:</span>
              <span>{transaction.inventory_locations?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Direction:</span>
              <Badge variant={transaction.direction === 'in' ? 'default' : 'destructive'}>
                {transaction.direction === 'in' ? 'Stock In' : 'Stock Out'} ({transaction.qty})
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Status:</span>
              <Badge className={getStatusColor(transaction.status || 'pending')}>
                {(transaction.status || 'pending').charAt(0).toUpperCase() + (transaction.status || 'pending').slice(1)}
              </Badge>
            </div>
            {transaction.reference && (
              <div className="flex justify-between">
                <span className="font-medium">Reference:</span>
                <span className="text-sm">{transaction.reference}</span>
              </div>
            )}
          </div>

          {/* Reason Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Reason {transaction.status === 'pending' && <span className="text-red-500">*</span>}
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for approval/rejection..."
              className="min-h-[80px]"
            />
          </div>

          {/* Action Buttons */}
          {transaction.status === 'pending' && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={approveTransaction.isPending}
                className="flex-1 gap-2"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approveTransaction.isPending}
                className="flex-1 gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
            </div>
          )}

          {transaction.status !== 'pending' && (
            <div className="text-center text-sm text-muted-foreground">
              This transaction has already been {transaction.status}.
              {transaction.rejection_reason && (
                <div className="mt-2 p-2 bg-red-50 text-red-700 rounded text-left">
                  <strong>Rejection Reason:</strong> {transaction.rejection_reason}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};