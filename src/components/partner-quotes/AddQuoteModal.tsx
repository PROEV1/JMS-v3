import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface AddQuoteModalProps {
  job: {
    id: string;
    order_number: string;
    client_name: string;
    job_type: 'installation' | 'assessment' | 'service_call';
    partner_status: string;
    partner_id: string;
    total_amount: number;
    require_file?: boolean;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteAdded: () => void;
  partnerName: string;
}

export function AddQuoteModal({ job, open, onOpenChange, onQuoteAdded, partnerName }: AddQuoteModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: job.total_amount?.toString() || '',
    currency: 'GBP',
    notes: '',
    file: null as File | null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount) {
      toast({
        title: "Error",
        description: "Quote amount is required",
        variant: "destructive",
      });
      return;
    }

    if (job.require_file && !formData.file) {
      toast({
        title: "Error", 
        description: "Quote file is required for this partner",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let fileUrl = null;
      let storagePath = null;

      // Upload file if provided
      if (formData.file) {
        const fileExt = formData.file.name.split('.').pop();
        const fileName = `quote-${job.id}-${Date.now()}.${fileExt}`;
        storagePath = `partner-quotes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('partner-quotes')
          .upload(storagePath, formData.file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('partner-quotes')
          .getPublicUrl(storagePath);

        fileUrl = publicUrl;
      }

      // Create quote record
      const { error } = await supabase
        .from('partner_quotes')
        .insert({
          order_id: job.id,
          partner_id: job.partner_id,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          notes: formData.notes,
          file_url: fileUrl,
          storage_path: storagePath,
          storage_bucket: 'partner-quotes',
          status: 'submitted'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Quote submitted successfully",
      });

      onQuoteAdded();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        amount: job.total_amount?.toString() || '',
        currency: 'GBP',
        notes: '',
        file: null
      });
    } catch (error) {
      console.error('Error submitting quote:', error);
      toast({
        title: "Error",
        description: "Failed to submit quote",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      setFormData(prev => ({ ...prev, file }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Quote</DialogTitle>
          <DialogDescription>
            Submit a quote for {job.client_name} ({job.order_number})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Quote Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="file">Quote Document {job.require_file && '*'}</Label>
            <div className="mt-1">
              <input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('file')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {formData.file ? formData.file.name : 'Upload Document'}
              </Button>
            </div>
            {formData.file && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {formData.file.name} ({(formData.file.size / 1024 / 1024).toFixed(2)}MB)
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes or comments..."
              rows={3}
            />
          </div>

          {job.require_file && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This partner requires a quote document to be uploaded.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Quote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}