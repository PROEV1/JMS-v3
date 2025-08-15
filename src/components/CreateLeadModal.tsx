
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/hooks/useLeads';
import { validateLeadData } from '@/utils/leadUtils';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  clients?: Array<{ id: string; full_name: string; email: string }>;
}

export const CreateLeadModal = ({ isOpen, onClose, onSuccess, clients = [] }: CreateLeadModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    source: '',
    notes: '',
    client_id: '',
    product_name: '',
    product_price: '',
    total_price: '',
    width_cm: '',
    finish: '',
    luxe_upgrade: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      const validationData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        total_price: formData.total_price ? parseFloat(formData.total_price) : undefined,
        product_price: formData.product_price ? parseFloat(formData.product_price) : undefined,
        width_cm: formData.width_cm ? parseFloat(formData.width_cm) : undefined,
      };
      const errors = validateLeadData(validationData);
      if (errors.length > 0) {
        toast({
          title: "Validation Error",
          description: errors.join(', '),
          variant: "destructive",
        });
        return;
      }

      // Create lead data object
      const leadData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        message: formData.message.trim() || undefined,
        source: formData.source.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        client_id: formData.client_id || undefined,
        product_name: formData.product_name.trim() || undefined,
        product_price: formData.product_price ? parseFloat(formData.product_price) : undefined,
        total_price: formData.total_price ? parseFloat(formData.total_price) : undefined,
        width_cm: formData.width_cm ? parseFloat(formData.width_cm) : undefined,
        finish: formData.finish.trim() || undefined,
        luxe_upgrade: formData.luxe_upgrade,
        status: 'new' as const
      };

      // Call the success handler with the lead data
      onSuccess(leadData as Lead);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        message: '',
        source: '',
        notes: '',
        client_id: '',
        product_name: '',
        product_price: '',
        total_price: '',
        width_cm: '',
        finish: '',
        luxe_upgrade: false
      });
      
      onClose();
      
      toast({
        title: "Success",
        description: "Lead created successfully",
      });

    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        title: "Error",
        description: "Failed to create lead",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                placeholder="e.g., Website, Referral, etc."
              />
            </div>
          </div>

          {clients.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="client_id">Associate with Client (Optional)</Label>
              <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name} ({client.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <h4 className="font-medium">Product Details (Optional)</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_name">Product Name</Label>
                <Input
                  id="product_name"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="e.g., 3-Drawers Only"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="finish">Finish</Label>
                <Input
                  id="finish"
                  value={formData.finish}
                  onChange={(e) => setFormData({ ...formData, finish: e.target.value })}
                  placeholder="e.g., Standard White Matt"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_price">Product Price (£)</Label>
                <Input
                  id="product_price"
                  type="number"
                  step="0.01"
                  value={formData.product_price}
                  onChange={(e) => setFormData({ ...formData, product_price: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="total_price">Total Price (£)</Label>
                <Input
                  id="total_price"
                  type="number"
                  step="0.01"
                  value={formData.total_price}
                  onChange={(e) => setFormData({ ...formData, total_price: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="width_cm">Width (cm)</Label>
                <Input
                  id="width_cm"
                  type="number"
                  step="0.1"
                  value={formData.width_cm}
                  onChange={(e) => setFormData({ ...formData, width_cm: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Internal notes about this lead..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
