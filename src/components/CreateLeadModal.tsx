import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Search, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateLeadData } from '@/utils/leadUtils';
import { cn } from '@/lib/utils';
import { CreateClientModal } from './CreateClientModal';

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
}

interface Product {
  id: string;
  name: string;
  base_price: number;
  description: string | null;
  category: string | null;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [newClientMode, setNewClientMode] = useState(false);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
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
      loadProducts();
    }
  }, [isOpen]);

  // Handle clicking outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setClientSearchOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setProductSearchOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setClientSearchOpen(false);
        setProductSearchOpen(false);
      }
    };

    if (clientSearchOpen || productSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [clientSearchOpen, productSearchOpen]);

  const loadClients = async () => {
    try {
      console.log('Loading clients...');
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, email, phone, address')
        .order('full_name');

      if (error) {
        console.error('Supabase error loading clients:', error);
        throw error;
      }
      
      // Defensive array guard
      const clientsArray = Array.isArray(data) ? data : [];
      console.log('Loaded clients:', clientsArray.length);
      setClients(clientsArray);
    } catch (error) {
      console.error('Error loading clients:', error);
      setClients([]); // Ensure array is always set
      toast({
        title: "Warning",
        description: "Could not load clients list",
        variant: "destructive",
      });
    }
  };

  const loadProducts = async () => {
    try {
      console.log('Loading products...');
      const { data, error } = await supabase
        .from('products')
        .select('id, name, base_price, description, category')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Supabase error loading products:', error);
        throw error;
      }
      
      // Defensive array guard
      const productsArray = Array.isArray(data) ? data : [];
      console.log('Loaded products:', productsArray.length);
      setProducts(productsArray);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]); // Ensure array is always set
      toast({
        title: "Warning", 
        description: "Could not load products list",
        variant: "destructive",
      });
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

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setFormData(prev => ({
      ...prev,
      product_name: product.name,
      product_price: product.base_price.toString(),
      product_details: product.description || ''
    }));
    setProductSearchOpen(false);
  };

  const handleCreateClient = async () => {
    setShowCreateClientModal(true);
  };

  const handleClientCreated = (newClient: any) => {
    console.log('Client created callback received:', newClient);
    setShowCreateClientModal(false);
    
    // Defensive check for client data
    if (!newClient || !newClient.id) {
      console.error('Invalid client data received:', newClient);
      toast({
        title: "Error",
        description: "Invalid client data received",
        variant: "destructive",
      });
      return;
    }
    
    // Add the new client to the list immediately (optimistic update)
    setClients(prev => {
      const clientsArray = Array.isArray(prev) ? prev : [];
      return [...clientsArray, newClient];
    });
    
    // Auto-select the newly created client
    setSelectedClient(newClient);
    setFormData(prev => ({
      ...prev,
      name: newClient.full_name || '',
      email: newClient.email || '',
      phone: newClient.phone || '',
      address: newClient.address || ''
    }));
    
    // Close the client search popover if it's open
    setClientSearchOpen(false);
    
    toast({
      title: "Success",
      description: "Client created and selected",
    });
  };

  const resetForm = () => {
    setSelectedClient(null);
    setSelectedProduct(null);
    setNewClientMode(false);
    setClientSearchOpen(false);
    setProductSearchOpen(false);
    setClientSearchTerm('');
    setProductSearchTerm('');
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

  // Filter clients and products based on search
  const filteredClients = (clients || []).filter(client => 
    client?.full_name?.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    client?.email?.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const filteredProducts = (products || []).filter(product =>
    product?.name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product?.category?.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

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
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          // Prevent closing when interacting with dropdowns or nested modals
          const target = e.target as Element;
          const isInteractingWithDropdown = target.closest('[data-radix-select-content]') ||
                                           target.closest('.inline-dropdown-panel') ||
                                           showCreateClientModal;
          
          if (isInteractingWithDropdown) {
            e.preventDefault();
          }
        }}
      >
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
                  <div className="space-y-3 relative" ref={clientDropdownRef}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setClientSearchOpen(!clientSearchOpen);
                        setProductSearchOpen(false);
                      }}
                      className="w-full justify-between"
                    >
                      Search existing clients...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>

                    {clientSearchOpen && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-background border rounded-md shadow-lg inline-dropdown-panel">
                        <Command>
                          <CommandInput 
                            placeholder="Search clients..." 
                            value={clientSearchTerm}
                            onValueChange={setClientSearchTerm}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {Array.isArray(clients) && clients.length === 0 
                                ? "No clients found. Create a new client below." 
                                : "No clients match your search."}
                            </CommandEmpty>
                            <CommandGroup className="max-h-48 overflow-y-auto">
                              {filteredClients.map((client) => (
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
                          </CommandList>
                        </Command>
                      </div>
                    )}

                    <div className="flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">or</span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCreateClient}
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
                
                {/* Product Selection */}
                <div className="space-y-3">
                  <Label htmlFor="product">Product *</Label>
                  {selectedProduct ? (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{selectedProduct.name}</p>
                        <p className="text-sm text-muted-foreground">
                          £{selectedProduct.base_price.toLocaleString()} • {selectedProduct.category}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Selected</Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedProduct(null)}
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative" ref={productDropdownRef}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setProductSearchOpen(!productSearchOpen);
                          setClientSearchOpen(false);
                        }}
                        className="w-full justify-between"
                      >
                        Select product...
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>

                      {productSearchOpen && (
                        <div className="absolute top-full left-0 right-0 z-50 bg-background border rounded-md shadow-lg inline-dropdown-panel">
                          <Command>
                            <CommandInput 
                              placeholder="Search products..." 
                              value={productSearchTerm}
                              onValueChange={setProductSearchTerm}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {Array.isArray(products) && products.length === 0 
                                  ? "No products available." 
                                  : "No products match your search."}
                              </CommandEmpty>
                              <CommandGroup className="max-h-48 overflow-y-auto">
                                {filteredProducts.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    onSelect={() => handleProductSelect(product)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedProduct?.id === product.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium">{product.name}</div>
                                     <div className="text-sm text-muted-foreground">
                                       £{product.base_price?.toLocaleString() || '0'} • {product.category || 'Uncategorized'}
                                     </div>
                                   </div>
                                 </CommandItem>
                               ))}
                             </CommandGroup>
                           </CommandList>
                         </Command>
                       </div>
                     )}
                   </div>
                 )}
                </div>

                {/* Product Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="product_price">Product Price (£)</Label>
                    <Input
                      id="product_price"
                      type="number"
                      step="0.01"
                      value={formData.product_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, product_price: e.target.value }))}
                      placeholder="0.00"
                      disabled={!!selectedProduct}
                    />
                    {selectedProduct && (
                      <p className="text-xs text-muted-foreground mt-1">Auto-filled from selected product</p>
                    )}
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
                    disabled={!!selectedProduct && !!selectedProduct.description}
                  />
                  {selectedProduct?.description && (
                    <p className="text-xs text-muted-foreground mt-1">Auto-filled from selected product</p>
                  )}
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

        {/* Create Client Modal */}
        <CreateClientModal
          isOpen={showCreateClientModal}
          onClose={() => setShowCreateClientModal(false)}
          onSuccess={handleClientCreated}
        />
      </DialogContent>
    </Dialog>
  );
}