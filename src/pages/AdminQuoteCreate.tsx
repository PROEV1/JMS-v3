import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BrandPage, BrandContainer, BrandHeading1 } from '@/components/brand';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Save, Plus } from 'lucide-react';
import { ProductSelector } from '@/components/ProductSelector';

interface Client {
  id: string;
  full_name: string;
  email: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  category: string | null;
  is_active: boolean;
  specifications: any;
  images: Array<{
    image_url: string;
    image_name: string;
    is_primary: boolean;
  }>;
  configurations: Array<{
    id: string;
    configuration_type: string;
    option_name: string;
    option_value: string;
    price_modifier: number;
    is_default: boolean;
  }>;
}

interface SelectedProduct {
  product: Product;
  quantity: number;
  configuration: Record<string, string>;
  totalPrice: number;
}

export default function AdminQuoteCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [defaultDepositPercentage, setDefaultDepositPercentage] = useState(0);
  const [newClientData, setNewClientData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [formData, setFormData] = useState({
    client_id: searchParams.get('clientId') || '',
    room_info: '',
    range: '',
    finish: '',
    special_instructions: '',
    warranty_period: '5 years',
    includes_installation: true,
    deposit_required: 0,
    notes: '',
    expires_at: '',
  });

  // Calculate deposit when products change
  useEffect(() => {
    if (selectedProducts.length > 0 && defaultDepositPercentage > 0) {
      const totalCost = selectedProducts.reduce((sum, sp) => sum + sp.totalPrice, 0);
      if (formData.deposit_required === 0) {
        setFormData(prev => ({
          ...prev,
          deposit_required: Math.round(totalCost * (defaultDepositPercentage / 100))
        }));
      }
    }
  }, [selectedProducts, defaultDepositPercentage]);

  useEffect(() => {
    fetchClients();
    fetchQuoteDefaults();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
    }
  };

  const fetchQuoteDefaults = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'quote_defaults')
        .single();

      if (error || !data) {
        console.log('No quote defaults found, using hardcoded defaults');
        return;
      }

      const defaults = data.setting_value as any;
      setFormData(prev => ({
        ...prev,
        warranty_period: defaults.default_warranty_period || '5 years'
      }));
      
      // Store the percentage for later calculation when products are selected
      setDefaultDepositPercentage(defaults.default_deposit_percentage || 0);
    } catch (error) {
      console.error('Error fetching quote defaults:', error);
    }
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

      // Add to clients list and select
      const newClient = data.client;
      setClients(prev => [...prev, newClient]);
      setFilteredClients(prev => [...prev, newClient]);
      setFormData(prev => ({ ...prev, client_id: newClient.id }));
      
      // Clear search and close modal
      setClientSearch('');
      setIsClientModalOpen(false);
      setNewClientData({ full_name: '', email: '', phone: '', address: '' });
      
      console.log('New client created and selected:', newClient.id);
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
    
    console.log('Form submission:', {
      client_id: formData.client_id,
      selectedProducts: selectedProducts,
      selectedProductsLength: selectedProducts.length
    });
    
    if (!formData.client_id || selectedProducts.length === 0) {
      toast({
        title: "Validation Error",
        description: `Please select a client and at least one product. Client: ${formData.client_id ? 'Selected' : 'Not selected'}, Products: ${selectedProducts.length}`,
        variant: "destructive",
      });
      return;
    }

    // Validate expires_at date if provided
    let expiresAt = null;
    if (formData.expires_at) {
      const expiresDate = new Date(formData.expires_at);
      if (isNaN(expiresDate.getTime())) {
        toast({
          title: "Validation Error",
          description: "Invalid expiration date",
          variant: "destructive",
        });
        return;
      }
      expiresAt = expiresDate.toISOString();
    }

    // Validate numeric fields
    const depositRequired = Number(formData.deposit_required);
    if (isNaN(depositRequired) || depositRequired < 0) {
      toast({
        title: "Validation Error",
        description: "Deposit amount must be a valid positive number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Calculate totals from selected products
      const totalCost = selectedProducts.reduce((sum, sp) => sum + sp.totalPrice, 0);
      
      // Validate selected products have valid quantities
      for (const sp of selectedProducts) {
        console.log('Validating product:', {
          productName: sp.product.name,
          quantity: sp.quantity,
          quantityType: typeof sp.quantity,
          totalPrice: sp.totalPrice,
          totalPriceType: typeof sp.totalPrice
        });
        
        if (!Number.isInteger(sp.quantity) || sp.quantity <= 0) {
          throw new Error(`Invalid quantity for product ${sp.product.name}: ${sp.quantity} (type: ${typeof sp.quantity})`);
        }
        
        if (isNaN(sp.totalPrice) || sp.totalPrice <= 0) {
          throw new Error(`Invalid total price for product ${sp.product.name}: ${sp.totalPrice}`);
        }
      }
      
      // Create product details summary
      const productDetails = selectedProducts.map(sp => {
        const configText = Object.entries(sp.configuration).map(([type, value]) => `${type}: ${value}`).join(', ');
        return `${sp.product.name} (Qty: ${sp.quantity})${configText ? ` - ${configText}` : ''}`;
      }).join('\n');
      
      console.log('About to insert quote with data:', {
        client_id: formData.client_id,
        total_cost: totalCost,
        deposit_required: depositRequired,
        expires_at: expiresAt,
        productDetails: productDetails.substring(0, 100) + '...'
      });
      
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          client_id: formData.client_id,
          product_details: productDetails,
          materials_cost: 0,
          install_cost: 0,
          extras_cost: 0,
          total_cost: totalCost,
          room_info: formData.room_info || null,
          range: formData.range || null,
          finish: formData.finish || null,
          special_instructions: formData.special_instructions || null,
          warranty_period: formData.warranty_period,
          includes_installation: formData.includes_installation,
          deposit_required: depositRequired,
          notes: formData.notes || null,
          expires_at: expiresAt,
          status: 'sent',
          quote_number: '' // Will be auto-generated by trigger
        } as any)
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Create quote items with validated data
      const quoteItems = selectedProducts.map(sp => {
        const item = {
          quote_id: quote.id,
          product_id: sp.product.id,
          product_name: sp.product.name,
          quantity: parseInt(String(sp.quantity)), // Ensure integer
          unit_price: Number(sp.product.base_price),
          total_price: Number(sp.totalPrice),
          configuration: sp.configuration
        };
        
        console.log('Creating quote item:', item);
        return item;
      });

      console.log('About to insert quote items:', quoteItems);

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(quoteItems);

      if (itemsError) {
        console.error('Quote items insert error:', itemsError);
        throw itemsError;
      }

      toast({
        title: "Success",
        description: "Quote created successfully",
      });

      navigate(`/admin/quotes/${quote.id}`);
    } catch (error) {
      console.error('Error creating quote:', error);
      toast({
        title: "Error",
        description: "Failed to create quote",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/admin/quotes');
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClientSearch = (searchValue: string) => {
    setClientSearch(searchValue);
    if (!searchValue.trim()) {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client => 
        client.full_name.toLowerCase().includes(searchValue.toLowerCase()) ||
        client.email.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredClients(filtered);
    }
  };

  return (
    <BrandPage>
      <BrandContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
            <BrandHeading1>Create New Quote</BrandHeading1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Selection */}
            <ProductSelector 
              selectedProducts={selectedProducts}
              onSelectionChange={setSelectedProducts}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="client_id">Client *</Label>
                    <div className="space-y-2">
                      <Input
                        placeholder="Search clients..."
                        value={clientSearch}
                        onChange={(e) => handleClientSearch(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Select value={formData.client_id} onValueChange={(value) => handleInputChange('client_id', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredClients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.full_name} ({client.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" size="icon">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
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

                  <div>
                    <Label htmlFor="room_info">Understairs Width</Label>
                    <Input
                      id="room_info"
                      value={formData.room_info}
                      onChange={(e) => handleInputChange('room_info', e.target.value)}
                      placeholder="Enter understairs width..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="range">Range</Label>
                      <Input
                        id="range"
                        value={formData.range}
                        onChange={(e) => handleInputChange('range', e.target.value)}
                        placeholder="Product range"
                      />
                    </div>
                    <div>
                      <Label htmlFor="finish">Finish</Label>
                      <Input
                        id="finish"
                        value={formData.finish}
                        onChange={(e) => handleInputChange('finish', e.target.value)}
                        placeholder="Finish type"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Selected Products Summary */}
              {selectedProducts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Selected Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedProducts.map((sp, index) => (
                        <div key={`${sp.product.id}-${index}`} className="flex justify-between items-center p-3 border rounded">
                          <div>
                            <div className="font-medium">{sp.product.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Quantity: {sp.quantity} | Base Price: £{sp.product.base_price}
                            </div>
                            {Object.entries(sp.configuration).length > 0 && (
                              <div className="text-sm text-muted-foreground">
                                {Object.entries(sp.configuration).map(([type, value]) => 
                                  `${type}: ${value}`
                                ).join(', ')}
                              </div>
                            )}
                          </div>
                          <div className="text-lg font-semibold">
                            £{sp.totalPrice.toFixed(2)}
                          </div>
                        </div>
                      ))}
                      <div className="border-t pt-3 flex justify-between items-center font-semibold text-lg">
                        <span>Total:</span>
                        <span>£{selectedProducts.reduce((sum, sp) => sum + sp.totalPrice, 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Deposit */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="deposit_required">Deposit Required (£)</Label>
                    <Input
                      id="deposit_required"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.deposit_required}
                      onChange={(e) => handleInputChange('deposit_required', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Additional Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Additional Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="warranty_period">Warranty Period</Label>
                    <Select value={formData.warranty_period} onValueChange={(value) => handleInputChange('warranty_period', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 year">1 Year</SelectItem>
                        <SelectItem value="2 years">2 Years</SelectItem>
                        <SelectItem value="5 years">5 Years</SelectItem>
                        <SelectItem value="10 years">10 Years</SelectItem>
                        <SelectItem value="lifetime">Lifetime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includes_installation"
                      checked={formData.includes_installation}
                      onCheckedChange={(checked) => handleInputChange('includes_installation', checked)}
                    />
                    <Label htmlFor="includes_installation">Includes Installation</Label>
                  </div>

                  <div>
                    <Label htmlFor="expires_at">Quote Expires</Label>
                    <Input
                      id="expires_at"
                      type="date"
                      value={formData.expires_at}
                      onChange={(e) => handleInputChange('expires_at', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Notes & Instructions */}
              <Card>
                <CardHeader>
                  <CardTitle>Notes & Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="special_instructions">Special Instructions</Label>
                    <Textarea
                      id="special_instructions"
                      value={formData.special_instructions}
                      onChange={(e) => handleInputChange('special_instructions', e.target.value)}
                      placeholder="Any special requirements or instructions..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Internal Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Internal notes (not visible to client)..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={handleBack}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="btn-brand-primary">
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Creating...' : 'Create Quote'}
              </Button>
            </div>
          </form>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}