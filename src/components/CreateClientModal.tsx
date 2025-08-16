import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (client: any) => void;
}

export const CreateClientModal = ({ isOpen, onClose, onSuccess }: CreateClientModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    postcode: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      if (!formData.full_name.trim() || !formData.email.trim()) {
        toast({
          title: "Validation Error",
          description: "Name and email are required",
          variant: "destructive",
        });
        return;
      }

      // Create client using the admin function v2
      const { data, error } = await supabase.functions.invoke('admin-create-client-v2', {
        body: {
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          postcode: formData.postcode.trim() || null
        }
      });

      if (error) {
        console.error('Error creating client:', error);
        
        // Parse specific error message from FunctionsHttpError
        let errorMessage = 'Failed to create client';
        if (error.name === 'FunctionsHttpError') {
          try {
            const errorDetail = await error.context.json();
            errorMessage = errorDetail.error || errorMessage;
          } catch (parseError) {
            console.warn('Could not parse error detail:', parseError);
            errorMessage = error.message || errorMessage;
          }
        } else {
          errorMessage = error.message || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      console.log('Client created successfully:', data);
      
      // Reset form
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        address: '',
        postcode: ''
      });
      
      // Close the modal and return the created client data
      onClose();
      onSuccess(data.client);
      
      toast({
        title: "Success",
        description: data.isNewUser 
          ? `Client created successfully${data.temporaryPassword ? ` with temporary password: ${data.temporaryPassword}` : ''}`
          : "Existing user connected as client successfully",
      });

    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create client",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      address: '',
      postcode: ''
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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


          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              placeholder="Street address, city, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              value={formData.postcode}
              onChange={(e) => setFormData({ ...formData, postcode: e.target.value.toUpperCase() })}
              placeholder="e.g. SW1A 1AA"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};