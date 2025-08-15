import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Search, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateLeadData } from '@/utils/leadUtils';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
}

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (leadData: any) => void;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  message: string;
  notes: string;
  source: string;
  product_name: string;
  product_price: string;
  total_price: string;
  width_cm: string;
  finish: string;
  luxe_upgrade: boolean;
  accessories_data: any[];
  configuration: any;
  product_details: string;
}

export function CreateLeadModal({ isOpen, onClose, onSuccess }: CreateLeadModalProps) {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [newClientMode, setNewClientMode] = useState(false);
  const [formData, setFormData] = useState<FormData>({
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
    product_details: ''
  });

  // Available sources for dropdown
  const sources = [
    'Website', 'Phone', 'Email', 'Referral', 'Social Media', 'Advertisement', 'Other'
  ];

  // Available finishes
  const finishes = [
    'White', 'Black', 'Chrome', 'Brushed Steel', 'Wood Effect', 'Custom'
  ];

  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, email, phone, address')
        .order('full_name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setFormData(prev => ({
      ...prev,
      name: client.full_name,
      email: client.email,
      phone: client.phone || '',
      address: client.address || ''
    }));
    setClientSearchOpen(false);
    setNewClientMode(false);
  };

  const resetForm = () => {
    setSelectedClient(null);
    setNewClientMode(false);
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
      product_details: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasSelectedClient = !!selectedClient;
    
    // Convert numeric fields and prepare data for validation
    const leadData = {
      name: selectedClient?.full_name || formData.name,
      email: selectedClient?.email || formData.email,
      phone: selectedClient?.phone || formData.phone,
      address: selectedClient?.address || formData.address,
      message: formData.message,
      notes: formData.notes,
      source: formData.source,
      product_name: formData.product_name,
      product_details: formData.product_details,
      finish: formData.finish,
      luxe_upgrade: formData.luxe_upgrade,
      accessories_data: formData.accessories_data,
      configuration: formData.configuration,
      client_id: selectedClient?.id || null,
      status: 'new',
      product_price: formData.product_price ? parseFloat(formData.product_price) : null,
      total_price: formData.total_price ? parseFloat(formData.total_price) : null,
      width_cm: formData.width_cm ? parseFloat(formData.width_cm) : null,
    };

    const errors = validateLeadData(leadData, hasSelectedClient);

    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    try {
      await onSuccess(leadData);
      resetForm();
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
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{selectedClient.full_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                    </div>
                    <Badge variant="secondary">Selected</Badge>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={clientSearchOpen}
                          className="w-full justify-between"
                        >
                          Search existing clients...
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search clients..." />
                          <CommandEmpty>No clients found.</CommandEmpty>
                          <CommandGroup className="max-h-48 overflow-y-auto">
                            {clients.map((client) => (
                              <CommandItem
                                key={client.id}
                                onSelect={() => handleClientSelect(client)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div>
                                  <div className="font-medium">{client.full_name}</div>
                                  <div className="text-sm text-muted-foreground">{client.email}</div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <div className="flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">or</span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewClientMode(!newClientMode)}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create New Client
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Source Selection - moved up */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label htmlFor="source">Lead Source</Label>
                <Select value={formData.source} onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Contact Details - only show if no client selected or creating new */}
          {(!selectedClient || newClientMode) && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Contact Details</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required={!selectedClient}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        required={!selectedClient}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Address - auto-filled if client selected */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter property address"
                  disabled={selectedClient && selectedClient.address ? true : false}
                />
                {selectedClient?.address && (
                  <p className="text-xs text-muted-foreground">Auto-filled from selected client</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Product Information */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Label className="text-base font-semibold">Product Information</Label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="product_name">Product Name</Label>
                    <Input
                      id="product_name"
                      value={formData.product_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
                      placeholder="e.g. EV Charger Installation"
                    />
                  </div>
                  <div>
                    <Label htmlFor="finish">Finish</Label>
                    <Select value={formData.finish} onValueChange={(value) => setFormData(prev => ({ ...prev, finish: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select finish" />
                      </SelectTrigger>
                      <SelectContent>
                        {finishes.map((finish) => (
                          <SelectItem key={finish} value={finish}>
                            {finish}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="product_price">Product Price (£)</Label>
                    <Input
                      id="product_price"
                      type="number"
                      step="0.01"
                      value={formData.product_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, product_price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="total_price">Total Quote Price (£)</Label>
                    <Input
                      id="total_price"
                      type="number"
                      step="0.01"
                      value={formData.total_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="width_cm">Width (cm)</Label>
                    <Input
                      id="width_cm"
                      type="number"
                      value={formData.width_cm}
                      onChange={(e) => setFormData(prev => ({ ...prev, width_cm: e.target.value }))}
                      placeholder="e.g. 150"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="luxe_upgrade"
                    checked={formData.luxe_upgrade}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, luxe_upgrade: checked as boolean }))}
                  />
                  <Label htmlFor="luxe_upgrade" className="text-sm font-medium">
                    Luxe Upgrade
                  </Label>
                </div>

                <div>
                  <Label htmlFor="product_details">Product Details</Label>
                  <Textarea
                    id="product_details"
                    value={formData.product_details}
                    onChange={(e) => setFormData(prev => ({ ...prev, product_details: e.target.value }))}
                    placeholder="Additional product specifications or details"
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Message & Notes */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="message">Initial Message</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Customer's initial inquiry or message"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Internal Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Internal notes about this lead"
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}