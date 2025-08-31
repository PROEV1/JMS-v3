
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, X } from 'lucide-react';

interface AddQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: {
    id: string;
    order_number: string;
    client_name: string;
    partner_id?: string;
  };
  onQuoteAdded: () => void;
}

export function AddQuoteModal({ open, onOpenChange, job, onQuoteAdded }: AddQuoteModalProps) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type and size
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or image file",
          variant: "destructive",
        });
        return;
      }
      
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid quote amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let fileUrl = '';
      let storageBucket = '';
      let storagePath = '';

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${job.id}_${Date.now()}.${fileExt}`;
        const filePath = `partner-quotes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('partner-quotes')
          .upload(filePath, file);

        if (uploadError) {
          console.error('File upload error:', uploadError);
          toast({
            title: "Upload failed",
            description: "Failed to upload quote file",
            variant: "destructive",
          });
          return;
        }

        const { data: urlData } = supabase.storage
          .from('partner-quotes')
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
        storageBucket = 'partner-quotes';
        storagePath = filePath;
      }

      // Insert quote record
      const { error: insertError } = await supabase
        .from('partner_quotes')
        .insert({
          order_id: job.id,
          partner_id: job.partner_id || '', // This should be set from the job data
          amount: parseFloat(amount),
          currency,
          notes: notes || null,
          file_url: fileUrl || null,
          storage_bucket: storageBucket || null,
          storage_path: storagePath || null,
          status: 'submitted'
        });

      if (insertError) {
        console.error('Quote insert error:', insertError);
        toast({
          title: "Failed to add quote",
          description: "There was an error saving the quote",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Quote added successfully",
        description: `Quote of £${amount} has been submitted`,
      });

      // Reset form
      setAmount('');
      setNotes('');
      setFile(null);
      
      onQuoteAdded();
    } catch (error) {
      console.error('Error adding quote:', error);
      toast({
        title: "Error",
        description: "Failed to add quote",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setAmount('');
      setNotes('');
      setFile(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Quote</DialogTitle>
          <DialogDescription>
            Submit a quote for {job.client_name} ({job.order_number})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="amount">Quote Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                className="w-full p-2 border border-input rounded-md"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this quote..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label>Quote File</Label>
            <div className="mt-2">
              {file ? (
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <span className="text-sm">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50">
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload quote file (PDF, JPG, PNG)
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                  />
                </label>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding Quote...' : 'Add Quote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
