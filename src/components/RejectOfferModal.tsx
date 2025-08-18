import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { XCircle, Plus, Minus } from 'lucide-react';

interface DateRange {
  start_date: string;
  end_date: string;
}

interface RejectOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReject: (rejectionData: {
    reason: string;
    blockThisDate: boolean;
    blockDateRanges?: DateRange[];
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
  const [enableMultipleRanges, setEnableMultipleRanges] = useState(false);
  const [dateRanges, setDateRanges] = useState<DateRange[]>([{ start_date: '', end_date: '' }]);

  const handleSubmit = async () => {
    if (!rejectionReason.trim()) {
      return;
    }

    // Filter out empty or invalid date ranges
    const validRanges = dateRanges.filter(range => 
      range.start_date && range.end_date && new Date(range.start_date) <= new Date(range.end_date)
    );

    const rejectionData = {
      reason: rejectionReason.trim(),
      blockThisDate,
      ...(enableMultipleRanges && validRanges.length > 0 ? {
        blockDateRanges: validRanges
      } : {})
    };

    await onReject(rejectionData);
    handleClose();
  };

  const handleClose = () => {
    setRejectionReason('');
    setBlockThisDate(true);
    setEnableMultipleRanges(false);
    setDateRanges([{ start_date: '', end_date: '' }]);
    onClose();
  };

  const addDateRange = () => {
    setDateRanges([...dateRanges, { start_date: '', end_date: '' }]);
  };

  const removeDateRange = (index: number) => {
    if (dateRanges.length > 1) {
      setDateRanges(dateRanges.filter((_, i) => i !== index));
    }
  };

  const updateDateRange = (index: number, field: keyof DateRange, value: string) => {
    const newRanges = [...dateRanges];
    newRanges[index] = { ...newRanges[index], [field]: value };
    setDateRanges(newRanges);
  };

  const isValidDateRanges = !enableMultipleRanges || dateRanges.every(range => 
    !range.start_date || !range.end_date || new Date(range.start_date) <= new Date(range.end_date)
  );

  const canSubmit = rejectionReason.trim() && isValidDateRanges && !loading;

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
                id="block-date-ranges"
                checked={enableMultipleRanges}
                onCheckedChange={(checked) => setEnableMultipleRanges(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="block-date-ranges" className="text-sm font-medium">
                  Block additional periods
                </Label>
                <p className="text-xs text-muted-foreground">
                  Block multiple date ranges when you're away or unavailable
                </p>
              </div>
            </div>

            {enableMultipleRanges && (
              <div className="space-y-3 ml-6">
                {dateRanges.map((range, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <div>
                        <Label className="text-xs">From</Label>
                        <Input
                          type="date"
                          value={range.start_date}
                          onChange={(e) => updateDateRange(index, 'start_date', e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">To</Label>
                        <Input
                          type="date"
                          value={range.end_date}
                          onChange={(e) => updateDateRange(index, 'end_date', e.target.value)}
                          min={range.start_date || new Date().toISOString().split('T')[0]}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    {dateRanges.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeDateRange(index)}
                        className="mt-6"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDateRange}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Period
                </Button>

                {dateRanges.some(range => 
                  range.start_date && range.end_date && new Date(range.start_date) > new Date(range.end_date)
                ) && (
                  <p className="text-xs text-destructive">
                    Start dates cannot be after end dates
                  </p>
                )}
              </div>
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