import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/hooks/useLeads';
import { validateLeadData } from '@/utils/leadUtils';
import { Plus } from 'lucide-react';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  clients?: Array<{ id: string; full_name: string; email: string; phone?: string; address?: string }>;
}

export const CreateLeadModal = ({ isOpen, onClose, onSuccess, clients = [] }: CreateLeadModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [filteredClients, setFilteredClients] = useState(clients);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [products, setProducts] = useState<Array<{ id: string; name: string; base_price: number }>>([]);
  const [newClientData, setNewClientData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
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

  // Auto-fill form when client is selected
  useEffect(() => {
    if (formData.client_id) {
      const selectedClient = clients.find(c => c.id === formData.client_id);
      if (selectedClient) {
        setFormData(prev => ({
          ...prev,
          name: selectedClient.full_name,
          email: selectedClient.email,
          phone: selectedClient.phone || '',
          address: selectedClient.address || ''
        }));
      }
    }
  }, [formData.client_id, clients]);

  // Update filtered clients when clients prop or search changes
  useEffect(() => {
    if (!clientSearch.trim()) {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client => 
        client.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        client.email.toLowerCase().includes(clientSearch.toLowerCase())
      );
      setFilteredClients(filtered);
    }
  }, [clients, clientSearch]);

  // Fetch products when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, base_price')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    }
  };

  const handleClientSearch = (searchValue: string) => {
    setClientSearch(searchValue);
  };

  const createClient = async () => {
    if (!newClientData.full_name || !newClientData.email) {
      toast({
        title: "Validation Error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-client', {
        body: newClientData
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client created successfully",
      });

      // Select the new client
      const newClient = data.client;
      setFormData(prev => ({ ...prev, client_id: newClient.id }));
      
      // Clear search and close modal
      setClientSearch('');
      setIsClientModalOpen(false);
      setNewClientData({ full_name: '', email: '', phone: '', address: '' });
      
    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: "Error",
        description: "Failed to create client",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id) {
      toast({
        title: "Validation Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }

    const errors = validateLeadData({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      product_price: formData.product_price ? parseFloat(formData.product_price) : undefined,
      total_price: formData.total_price ? parseFloat(formData.total_price) : undefined,
      width_cm: formData.width_cm ? parseFloat(formData.width_cm) : undefined,
    } as any, !!formData.client_id);
    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Create lead data object
      const leadData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
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
      await onSuccess(leadData as Lead);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
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
      setClientSearch('');
      
      toast({
        title: "Success",
        description: "Lead created successfully",
      });
      
      onClose();
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
                disabled={!!formData.client_id}
                placeholder={formData.client_id ? "Auto-filled from selected client" : "Enter name"}
                required={!formData.client_id}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!formData.client_id}
                placeholder={formData.client_id ? "Auto-filled from selected client" : "Enter email"}
                required={!formData.client_id}
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
                disabled={!!formData.client_id}
                placeholder={formData.client_id ? "Auto-filled from selected client" : "Enter phone"}
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

          <div className="space-y-2">
            <Label htmlFor="address">Address (Optional)</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              disabled={!!formData.client_id}
              placeholder={formData.client_id ? "Auto-filled from selected client" : "Enter address"}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_id">Client *</Label>
            <div className="space-y-2">
              <Input
                placeholder="Search clients..."
                value={clientSearch}
                onChange={(e) => handleClientSearch(e.target.value)}
              />
              <div className="flex gap-2">
                <Select 
                  value={formData.client_id} 
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {filteredClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.full_name} ({client.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => setIsClientModalOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Client</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="new_client_name">Full Name *</Label>
                        <Input
                          id="new_client_name"
                          value={newClientData.full_name}
                          onChange={(e) => setNewClientData(prev => ({ ...prev, full_name: e.target.value }))}
                          placeholder="Enter client name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new_client_email">Email *</Label>
                        <Input
                          id="new_client_email"
                          type="email"
                          value={newClientData.email}
                          onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Enter email address"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new_client_phone">Phone</Label>
                        <Input
                          id="new_client_phone"
                          value={newClientData.phone}
                          onChange={(e) => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new_client_address">Address</Label>
                        <Textarea
                          id="new_client_address"
                          value={newClientData.address}
                          onChange={(e) => setNewClientData(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="Enter client address"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsClientModalOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="button" onClick={createClient}>
                          Create Client
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

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
                <Select
                  value={formData.product_name}
                  onValueChange={(value) => {
                    const selectedProduct = products.find(p => p.name === value);
                    setFormData({ 
                      ...formData, 
                      product_name: value,
                      product_price: selectedProduct ? selectedProduct.base_price.toString() : ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.name}>
                        {product.name} - £{product.base_price.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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