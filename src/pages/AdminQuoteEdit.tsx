import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

interface QuoteItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  configuration: Record<string, string>;
  product: Product;
}

interface Quote {
  id: string;
  quote_number: string;
  client_id: string;
  room_info: string | null;
  range: string | null;
  finish: string | null;
  special_instructions: string | null;
  warranty_period: string;
  includes_installation: boolean;
  deposit_required: number;
  notes: string | null;
  expires_at: string | null;
  status: string;
  total_cost: number;
  quote_items: QuoteItem[];
  client: Client;
}

export default function AdminQuoteEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(true);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [defaultDepositPercentage, setDefaultDepositPercentage] = useState(0);
  const [newClientData, setNewClientData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [formData, setFormData] = useState({
    client_id: '',
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

  useEffect(() => {
    fetchClients();
    fetchQuoteDefaults();
    if (id) {
      fetchQuote();
    }
  }, [id]);

  const fetchQuote = async () => {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(id, full_name, email),
          quote_items(
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price,
            configuration,
            product:products(
              id,
              name,
              description,
              base_price,
              category,
              is_active,
              specifications,
              images:product_images(image_url, image_name, is_primary),
              configurations:product_configurations(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Set form data from quote
      setFormData({
        client_id: data.client_id,
        room_info: data.room_info || '',
        range: data.range || '',
        finish: data.finish || '',
        special_instructions: data.special_instructions || '',
        warranty_period: data.warranty_period || '5 years',
        includes_installation: data.includes_installation ?? true,
        deposit_required: data.deposit_required || 0,
        notes: data.notes || '',
        expires_at: data.expires_at ? new Date(data.expires_at).toISOString().split('T')[0] : '',
      });

      // Convert quote items to selected products
      const selectedProds: SelectedProduct[] = data.quote_items.map((item: any) => ({
        product: item.product,
        quantity: item.quantity,
        configuration: (item.configuration as Record<string, string>) || {},
        totalPrice: item.total_price
      }));

      setSelectedProducts(selectedProds);
    } catch (error) {
      console.error('Error fetching quote:', error);
      toast({
        title: "Error",
        description: "Failed to load quote",
        variant: "destructive",
      });
    } finally {
      setFetchingQuote(false);
    }
  };

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
        .maybeSingle();

      if (error || !data) {
        console.log('No quote defaults found, using hardcoded defaults');
        return;
      }

      // Store defaults for later use, don't override existing quote data
      const defaults = data.setting_value as any;
      setDefaultDepositPercentage(defaults.default_deposit_percentage || 0);
      return defaults;
    } catch (error) {
      console.error('Error fetching quote defaults:', error);
      return null;
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
    
    if (!formData.client_id || selectedProducts.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select a client and at least one product",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const expiresAt = formData.expires_at ? new Date(formData.expires_at).toISOString() : null;
      
      // Calculate totals from selected products
      const totalCost = selectedProducts.reduce((sum, sp) => sum + sp.totalPrice, 0);
      
      // Create product details summary
      const productDetails = selectedProducts.map(sp => {
        const configText = Object.entries(sp.configuration).map(([type, value]) => `${type}: ${value}`).join(', ');
        return `${sp.product.name} (Qty: ${sp.quantity})${configText ? ` - ${configText}` : ''}`;
      }).join('\n');
      
      // Update quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({
          client_id: formData.client_id,
          product_details: productDetails,
          total_cost: totalCost,
          room_info: formData.room_info || null,
          range: formData.range || null,
          finish: formData.finish || null,
          special_instructions: formData.special_instructions || null,
          warranty_period: formData.warranty_period,
          includes_installation: formData.includes_installation,
          deposit_required: formData.deposit_required,
          notes: formData.notes || null,
          expires_at: expiresAt,
        })
        .eq('id', id);

      if (quoteError) throw quoteError;

      // Delete existing quote items
      const { error: deleteError } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', id);

      if (deleteError) throw deleteError;

      // Create new quote items
      const quoteItems = selectedProducts.map(sp => ({
        quote_id: id,
        product_id: sp.product.id,
        product_name: sp.product.name,
        quantity: sp.quantity,
        unit_price: sp.product.base_price,
        total_price: sp.totalPrice,
        configuration: sp.configuration
      }));

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(quoteItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: "Quote updated successfully",
      });

      navigate(`/admin/quotes/${id}`);
    } catch (error) {
      console.error('Error updating quote:', error);
      toast({
        title: "Error",
        description: "Failed to update quote",
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

  if (fetchingQuote) {
    return (
      <BrandPage>
        <BrandContainer>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-lg">Loading quote...</div>
            </div>
          </div>
        </BrandContainer>
      </BrandPage>
    );
  }

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
            <BrandHeading1>Edit Quote</BrandHeading1>
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
                {loading ? 'Updating...' : 'Update Quote'}
              </Button>
            </div>
          </form>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}