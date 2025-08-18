import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { XCircle } from 'lucide-react';

interface RejectOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReject: (rejectionData: {
    reason: string;
    blockThisDate: boolean;
    blockDateRange?: {
      start_date: string;
      end_date: string;
    };
  }) => Promise<void>;
  offeredDate: string;
  loading?: boolean;
}

export function RejectOfferModal({ 
  isOpen, 
  onClose, 
  onReject, 
  offeredDate,
  loading = false 
}: RejectOfferModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [blockThisDate, setBlockThisDate] = useState(true);
  const [blockDateRange, setBlockDateRange] = useState(false);
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');

  const handleSubmit = async () => {
    if (!rejectionReason.trim()) {
      return;
    }

    const rejectionData = {
      reason: rejectionReason.trim(),
      blockThisDate,
      ...(blockDateRange && blockStartDate && blockEndDate ? {
        blockDateRange: {
          start_date: blockStartDate,
          end_date: blockEndDate
        }
      } : {})
    };

    await onReject(rejectionData);
    handleClose();
  };

  const handleClose = () => {
    setRejectionReason('');
    setBlockThisDate(true);
    setBlockDateRange(false);
    setBlockStartDate('');
    setBlockEndDate('');
    onClose();
  };

  const isValidDateRange = !blockDateRange || 
    (blockStartDate && blockEndDate && new Date(blockStartDate) <= new Date(blockEndDate));

  const canSubmit = rejectionReason.trim() && isValidDateRange && !loading;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Reject Installation Offer
          </DialogTitle>
          <DialogDescription>
            Please let us know why this date doesn't work for you. We'll use this information to find better alternatives.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="rejection-reason" className="text-sm font-medium">
              Reason for rejection (required)
            </Label>
            <Textarea
              id="rejection-reason"
              placeholder="Please let us know why this date doesn't work for you..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>

          {/* Date blocking options */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="block-this-date"
                checked={blockThisDate}
                onCheckedChange={(checked) => setBlockThisDate(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="block-this-date" className="text-sm font-medium">
                  Don't offer this date again
                </Label>
                <p className="text-xs text-muted-foreground">
                  We won't suggest {new Date(offeredDate).toLocaleDateString('en-GB')} for future installations
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="block-date-range"
                checked={blockDateRange}
                onCheckedChange={(checked) => setBlockDateRange(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="block-date-range" className="text-sm font-medium">
                  Block a date range
                </Label>
                <p className="text-xs text-muted-foreground">
                  Block multiple dates when you're away or unavailable
                </p>
              </div>
            </div>

            {blockDateRange && (
              <div className="grid grid-cols-2 gap-3 ml-6">
                <div>
                  <Label htmlFor="start-date" className="text-xs">From</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={blockStartDate}
                    onChange={(e) => setBlockStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-xs">To</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={blockEndDate}
                    onChange={(e) => setBlockEndDate(e.target.value)}
                    min={blockStartDate || new Date().toISOString().split('T')[0]}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {blockDateRange && blockStartDate && blockEndDate && new Date(blockStartDate) > new Date(blockEndDate) && (
              <p className="text-xs text-destructive ml-6">
                Start date cannot be after end date
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1"
            >
              {loading ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}