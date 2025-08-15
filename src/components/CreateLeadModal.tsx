
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, User, Mail, Phone, MapPin, Plus } from 'lucide-react';
import { validateLeadData } from '@/utils/leadUtils';
import { useToast } from '@/hooks/use-toast';

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
}

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (leadData: any) => void;
  clients: Client[];
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  clients
}) => {
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    message: '',
    notes: '',
    source: '',
    product_name: '',
    product_price: '',
    total_price: '',
    width_cm: '',
    finish: '',
    luxe_upgrade: false,
    accessories_data: [] as any[],
    configuration: {} as any,
    product_details: '',
  });

  // Filter clients based on search
  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.email.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedClient(null);
      setClientSearch('');
      setShowNewClientForm(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        message: '',
        notes: '',
        source: '',
        product_name: '',
        product_price: '',
        total_price: '',
        width_cm: '',
        finish: '',
        luxe_upgrade: false,
        accessories_data: [],
        configuration: {},
        product_details: '',
      });
    }
  }, [isOpen]);

  // Auto-fill form when client is selected
  useEffect(() => {
    if (selectedClient) {
      setFormData(prev => ({
        ...prev,
        name: selectedClient.full_name,
        email: selectedClient.email,
        phone: selectedClient.phone || '',
        address: selectedClient.address || '',
      }));
      setShowNewClientForm(false);
    }
  }, [selectedClient]);

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setClientSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasSelectedClient = !!selectedClient;
    const errors = validateLeadData(formData, hasSelectedClient);

    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    try {
      const leadData = {
        ...formData,
        client_id: selectedClient?.id || null,
        status: 'new',
        product_price: formData.product_price ? parseFloat(formData.product_price) : null,
        total_price: formData.total_price ? parseFloat(formData.total_price) : null,
        width_cm: formData.width_cm ? parseFloat(formData.width_cm) : null,
      };

      await onSuccess(leadData);
      onClose();
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        title: "Error",
        description: "Failed to create lead",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Selection Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Client Selection *</Label>
                  {selectedClient && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedClient(null)}
                    >
                      Change Client
                    </Button>
                  )}
                </div>

                {selectedClient ? (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{selectedClient.full_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{selectedClient.email}</span>
                          </div>
                          {selectedClient.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{selectedClient.phone}</span>
                            </div>
                          )}
                          {selectedClient.address && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{selectedClient.address}</span>
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary">Selected</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search existing clients by name or email..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {clientSearch && filteredClients.length > 0 && (
                      <div className="border rounded-md max-h-48 overflow-y-auto">
                        {filteredClients.map((client) => (
                          <div
                            key={client.id}
                            className="p-3 hover:bg-muted cursor-pointer border-b last:border-0"
                            onClick={() => handleClientSelect(client)}
                          >
                            <div className="font-medium">{client.full_name}</div>
                            <div className="text-sm text-muted-foreground">{client.email}</div>
                            {client.phone && (
                              <div className="text-sm text-muted-foreground">{client.phone}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowNewClientForm(!showNewClientForm)}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        {showNewClientForm ? 'Hide New Client Form' : 'Create New Client'}
                      </Button>
                    </div>

                    {showNewClientForm && (
                      <Card>
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="name">Full Name *</Label>
                              <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required={!selectedClient}
                              />
                            </div>
                            <div>
                              <Label htmlFor="email">Email *</Label>
                              <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required={!selectedClient}
                              />
                            </div>
                            <div>
                              <Label htmlFor="phone">Phone</Label>
                              <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="address">Address</Label>
                              <Input
                                id="address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Source Section */}
          <div>
            <Label htmlFor="source">Lead Source</Label>
            <Select value={formData.source} onValueChange={(value) => setFormData({ ...formData, source: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select lead source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="social_media">Social Media</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="phone_call">Phone Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="trade_show">Trade Show</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Product Information */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Product Information</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="product_name">Product Name</Label>
                <Input
                  id="product_name"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="product_price">Product Price (£)</Label>
                <Input
                  id="product_price"
                  type="number"
                  step="0.01"
                  value={formData.product_price}
                  onChange={(e) => setFormData({ ...formData, product_price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="total_price">Total Price (£)</Label>
                <Input
                  id="total_price"
                  type="number"
                  step="0.01"
                  value={formData.total_price}
                  onChange={(e) => setFormData({ ...formData, total_price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="width_cm">Width (cm)</Label>
                <Input
                  id="width_cm"
                  type="number"
                  value={formData.width_cm}
                  onChange={(e) => setFormData({ ...formData, width_cm: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="product_details">Product Details</Label>
              <Textarea
                id="product_details"
                value={formData.product_details}
                onChange={(e) => setFormData({ ...formData, product_details: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Additional Information</Label>
            <div>
              <Label htmlFor="message">Customer Message</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              Create Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
