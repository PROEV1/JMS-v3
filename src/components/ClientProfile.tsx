import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Calendar, FileText, MessageSquare, User, Mail, Phone, MapPin, Edit, Eye, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProductSelector } from './ProductSelector';
import { ClientLeadHistory } from './ClientLeadHistory';
import MessagesSection from './MessagesSection';


interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  user_id: string | null;
}

interface UserAccount {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  last_login: string | null;
  created_at: string;
}

interface Project {
  id: string;
  project_name: string;
  status: string;
  created_at: string;
  scheduled_date: string | null;
  installer_name: string | null;
  notes: string | null;
}

interface Quote {
  id: string;
  quote_number: string;
  product_details: string;
  materials_cost: number;
  install_cost: number;
  extras_cost: number;
  total_cost: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  notes: string | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  created_at: string;
  installation_date: string | null;
}

interface SelectedProduct {
  product: {
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
  };
  quantity: number;
  configuration: Record<string, string>;
  totalPrice: number;
}

interface ClientProfileProps {
  client: Client;
  onBack: () => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ client, onBack }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [quoteForm, setQuoteForm] = useState({
    product_details: '',
    expires_at: '',
    notes: '',
    room_info: '',
    range: '',
    finish: '',
    deposit_required: 0,
    warranty_period: '1 year',
    includes_installation: false,
    special_instructions: ''
  });
  const [clientForm, setClientForm] = useState({
    full_name: client.full_name,
    email: client.email,
    phone: client.phone || '',
    address: client.address || ''
  });

  useEffect(() => {
    loadClientData();
  }, [client.id]);

  const loadClientData = async () => {
    try {
      // Load user account if client has user_id
      if (client.user_id) {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', client.user_id)
          .single();

        if (userError && userError.code !== 'PGRST116') {
          console.error('User profile error:', userError);
        } else if (userData) {
          setUserAccount(userData);
        }
      }

      // Load projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Load quotes
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;

      // Load orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Orders error:', ordersError);
        throw ordersError;
      }

      console.log('Loaded orders for client:', client.id, ordersData);

      setProjects(projectsData || []);
      setQuotes(quotesData || []);
      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error loading client data:', error);
      toast({
        title: "Error",
        description: "Failed to load client data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuote = async () => {
    if (selectedProducts.length === 0 && !quoteForm.product_details.trim()) {
      toast({
        title: "Error",
        description: "Please select products or provide product details",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get payment config to calculate deposit
      const { data: configData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_config')
        .single();

      const paymentConfig = configData?.setting_value as any;
      const materialsCost = selectedProducts.reduce((total, item) => total + item.totalPrice, 0);
      const totalCost = materialsCost;
      
      let depositRequired = 0;
      if (paymentConfig?.deposit_type === 'percentage') {
        depositRequired = Math.round(totalCost * (paymentConfig.deposit_amount / 100));
      } else if (paymentConfig?.deposit_type === 'fixed') {
        depositRequired = paymentConfig.deposit_amount;
      }

      // Generate quote number
      const quoteNumber = `Q-${Date.now()}`;

      // Create quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          client_id: client.id,
          quote_number: quoteNumber,
          product_details: quoteForm.product_details || 'Products selected from catalog',
          materials_cost: materialsCost,
          install_cost: 0,
          extras_cost: 0,
          total_cost: totalCost,
          deposit_required: depositRequired,
          expires_at: quoteForm.expires_at || null,
          notes: quoteForm.notes || null,
          status: 'sent'
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Create quote items for selected products
      if (selectedProducts.length > 0) {
        const quoteItems = selectedProducts.map(item => ({
          quote_id: quoteData.id,
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.base_price,
          total_price: item.totalPrice,
          configuration: {}
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(quoteItems);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: "Quote created successfully",
      });

      setShowCreateQuote(false);
      setSelectedProducts([]);
      setQuoteForm({
        product_details: '',
        expires_at: '',
        notes: '',
        room_info: '',
        range: '',
        finish: '',
        deposit_required: 0,
        warranty_period: '1 year',
        includes_installation: false,
        special_instructions: ''
      });
      loadClientData();
    } catch (error) {
      console.error('Error creating quote:', error);
      toast({
        title: "Error",
        description: "Failed to create quote",
        variant: "destructive",
      });
    }
  };

  const handleEditClient = async () => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          full_name: clientForm.full_name,
          email: clientForm.email,
          phone: clientForm.phone || null,
          address: clientForm.address || null
        })
        .eq('id', client.id);

      if (error) throw error;

      // If client has user account, sync the changes to the profile
      if (client.user_id && userAccount) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: clientForm.full_name,
            email: clientForm.email
          })
          .eq('user_id', client.user_id);

        if (profileError) {
          console.error('Error updating user profile:', profileError);
          // Don't fail the entire operation for this
        }
      }

      toast({
        title: "Success",
        description: "Client information updated successfully",
      });

      setShowEditClient(false);
      // Update the client object
      Object.assign(client, clientForm);
      // Reload data to get updated user account info
      loadClientData();
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: "Error",
        description: "Failed to update client information",
        variant: "destructive",
      });
    }
  };

  const handleEditQuote = (quote: Quote) => {
    setEditingQuote(quote);
    setQuoteForm({
      product_details: quote.product_details,
      expires_at: quote.expires_at ? new Date(quote.expires_at).toISOString().split('T')[0] : '',
      notes: quote.notes || '',
      room_info: '',
      range: '',
      finish: '',
      deposit_required: 0,
      warranty_period: '1 year',
      includes_installation: false,
      special_instructions: ''
    });
    // Load quote items for editing
    loadQuoteItems(quote.id);
  };

  const loadQuoteItems = async (quoteId: string) => {
    try {
      const { data, error } = await supabase
        .from('quote_items')
        .select(`
          *,
          product:products(
            *,
            images:product_images(*),
            configurations:product_configurations(*)
          )
        `)
        .eq('quote_id', quoteId);

      if (error) throw error;

      const products: SelectedProduct[] = data.map(item => ({
        product: {
          ...item.product,
          images: item.product.images || [],
          configurations: item.product.configurations || []
        },
        quantity: item.quantity,
        configuration: typeof item.configuration === 'object' && item.configuration !== null ? item.configuration as Record<string, string> : {},
        totalPrice: item.total_price
      }));
      
      setSelectedProducts(products);
    } catch (error) {
      console.error('Error loading quote items:', error);
    }
  };

  const handleUpdateQuote = async () => {
    if (!editingQuote) return;

    try {
      const materialsCost = selectedProducts.reduce((total, item) => total + item.totalPrice, 0);

      // Update quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({
          product_details: quoteForm.product_details || 'Products selected from catalog',
          materials_cost: materialsCost,
          total_cost: materialsCost,
          expires_at: quoteForm.expires_at || null,
          notes: quoteForm.notes || null
        })
        .eq('id', editingQuote.id);

      if (quoteError) throw quoteError;

      // Delete existing quote items
      const { error: deleteError } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', editingQuote.id);

      if (deleteError) throw deleteError;

      // Create new quote items
      if (selectedProducts.length > 0) {
        const quoteItems = selectedProducts.map(item => ({
          quote_id: editingQuote.id,
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.base_price,
          total_price: item.totalPrice,
          configuration: {}
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(quoteItems);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Success",
        description: "Quote updated successfully",
      });

      setEditingQuote(null);
      setSelectedProducts([]);
      setQuoteForm({
        product_details: '',
        expires_at: '',
        notes: '',
        room_info: '',
        range: '',
        finish: '',
        deposit_required: 0,
        warranty_period: '1 year',
        includes_installation: false,
        special_instructions: ''
      });
      loadClientData();
    } catch (error) {
      console.error('Error updating quote:', error);
      toast({
        title: "Error",
        description: "Failed to update quote",
        variant: "destructive",
      });
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete quote items first
      const { error: itemsError } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', quoteId);

      if (itemsError) throw itemsError;

      // Delete quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (quoteError) throw quoteError;

      toast({
        title: "Success",
        description: "Quote deleted successfully",
      });

      loadClientData();
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: "Error",
        description: "Failed to delete quote",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-blue-500';
      case 'accepted': return 'bg-green-500';
      case 'declined': return 'bg-red-500';
      case 'expired': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const handleResendInvite = async () => {
    if (!client.user_id || !userAccount) return;

    try {
      const { error } = await supabase.functions.invoke('send-client-invite', {
        body: {
          email: client.email,
          full_name: client.full_name,
          tempPassword: 'PasswordReset123!', // This should be generated
          siteUrl: window.location.origin
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invitation resent successfully",
      });
    } catch (error) {
      console.error('Error resending invite:', error);
      toast({
        title: "Error",
        description: "Failed to resend invitation",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async () => {
    if (!client.user_id || !userAccount) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(client.email, {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password reset email sent",
      });
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast({
        title: "Error",
        description: "Failed to send password reset email",
        variant: "destructive",
      });
    }
  };

  const handleDeactivateUser = async () => {
    if (!client.user_id || !userAccount) return;

    const newStatus = userAccount.status === 'active' ? 'inactive' : 'active';
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('user_id', client.user_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `User account ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      });

      // Reload data to get updated status
      loadClientData();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getTotalQuoteValue = () => {
    const materialsCost = selectedProducts.reduce((total, item) => total + item.totalPrice, 0);
    return materialsCost;
  };

  const getAccountStatus = () => {
    if (!userAccount) return 'No Account';
    if (userAccount.status === 'inactive') return 'Deactivated';
    if (!userAccount.last_login) return 'Never Logged In';
    return 'Active';
  };

  const getAccountStatusColor = () => {
    const status = getAccountStatus();
    switch (status) {
      case 'Active': return 'bg-green-500';
      case 'Never Logged In': return 'bg-yellow-500';
      case 'Deactivated': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleCreateUserAccount = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-client-user', {
        body: {
          clientId: client.id,
          email: client.email,
          fullName: client.full_name
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Portal account created! Temporary password: ${data.tempPassword}`,
      });

      // Send welcome email with login details
      await supabase.functions.invoke('send-client-invite', {
        body: {
          email: client.email,
          full_name: client.full_name,
          tempPassword: data.tempPassword,
          siteUrl: window.location.origin
        }
      });

      // Reload data to show the new account
      loadClientData();
    } catch (error) {
      console.error('Error creating user account:', error);
      toast({
        title: "Error",
        description: "Failed to create portal account",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-4">
            ← Back to Clients
          </Button>
          <h1 className="text-3xl font-bold">{client.full_name}</h1>
          <p className="text-muted-foreground">Client Profile</p>
        </div>
        <Dialog open={showCreateQuote} onOpenChange={setShowCreateQuote}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Quote</DialogTitle>
              <DialogDescription>
                Create a quote for {client.full_name}
              </DialogDescription>
            </DialogHeader>
            
              <div className="space-y-6">
                {/* Product Selection Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Select Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProductSelector
                      selectedProducts={selectedProducts}
                      onSelectionChange={setSelectedProducts}
                    />
                  </CardContent>
                </Card>

                {/* Basic Client and Room Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Client & Room Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="room_info">Understairs Width</Label>
                      <Input
                        id="room_info"
                        value={quoteForm.room_info}
                        onChange={(e) => setQuoteForm({ ...quoteForm, room_info: e.target.value })}
                        placeholder="Enter understairs width..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="range">Range</Label>
                        <Input
                          id="range"
                          value={quoteForm.range}
                          onChange={(e) => setQuoteForm({ ...quoteForm, range: e.target.value })}
                          placeholder="Product range"
                        />
                      </div>
                      <div>
                        <Label htmlFor="finish">Finish</Label>
                        <Input
                          id="finish"
                          value={quoteForm.finish}
                          onChange={(e) => setQuoteForm({ ...quoteForm, finish: e.target.value })}
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

                {/* Payment Details */}
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
                        value={quoteForm.deposit_required}
                        onChange={(e) => setQuoteForm({ ...quoteForm, deposit_required: parseFloat(e.target.value) || 0 })}
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
                      <Select value={quoteForm.warranty_period} onValueChange={(value) => setQuoteForm({ ...quoteForm, warranty_period: value })}>
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
                        checked={quoteForm.includes_installation}
                        onCheckedChange={(checked) => setQuoteForm({ ...quoteForm, includes_installation: checked })}
                      />
                      <Label htmlFor="includes_installation">Includes Installation</Label>
                    </div>

                    <div>
                      <Label htmlFor="expires_at">Quote Expires</Label>
                      <Input
                        id="expires_at"
                        type="date"
                        value={quoteForm.expires_at}
                        onChange={(e) => setQuoteForm({ ...quoteForm, expires_at: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={quoteForm.notes}
                        onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                        placeholder="Additional notes..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="special_instructions">Special Instructions</Label>
                      <Textarea
                        id="special_instructions"
                        value={quoteForm.special_instructions}
                        onChange={(e) => setQuoteForm({ ...quoteForm, special_instructions: e.target.value })}
                        placeholder="Special instructions or requests..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="product_details">Additional Product Details</Label>
                      <Textarea
                        id="product_details"
                        value={quoteForm.product_details}
                        onChange={(e) => setQuoteForm({ ...quoteForm, product_details: e.target.value })}
                        placeholder="Any additional product details or customizations..."
                        rows={4}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Separator />

                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total:</span>
                      <span>{formatCurrency(selectedProducts.reduce((total, item) => total + item.totalPrice, 0))}</span>
                    </div>
                  </div>
                  <Button 
                    onClick={handleCreateQuote} 
                    disabled={selectedProducts.length === 0 && !quoteForm.product_details.trim()}
                    size="lg"
                  >
                    Create Quote
                  </Button>
                </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Client Details, Orders, Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Client Details
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowEditClient(true)}>
                Edit
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{client.email}</span>
            </div>
            {client.phone && (
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.phone}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.address}</span>
              </div>
            )}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Client since {new Date(client.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length > 0 ? (
              <div className="space-y-3">
                {orders.slice(0, 3).map((order) => (
                  <div key={order.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{order.order_number}</h4>
                        <Badge variant="outline" className="mt-1">{order.status.replace('_', ' ')}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/order/${order.id}`)}
                        className="ml-2 flex-shrink-0"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                    <p className="text-sm font-medium">{formatCurrency(order.total_amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(order.created_at).toLocaleDateString()}
                    </p>
                    {order.installation_date && (
                      <p className="text-xs text-muted-foreground">
                        Installation: {new Date(order.installation_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
                {orders.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{orders.length - 3} more orders
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center">No orders yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Recent Quotes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quotes.length > 0 ? (
              <div className="space-y-3">
                {quotes.slice(0, 3).map((quote) => (
                  <div key={quote.id} className="p-3 border rounded-lg">
                     <div className="flex justify-between items-start mb-2">
                       <div className="flex-1 min-w-0">
                         <h4 className="font-medium truncate">{quote.quote_number}</h4>
                         <Badge className={`${getStatusColor(quote.status)} mt-1`}>
                           {quote.status}
                         </Badge>
                       </div>
                       <div className="flex gap-1 ml-2 flex-shrink-0">
                         <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/quotes/${quote.id}`)}>
                           <Eye className="h-3 w-3" />
                         </Button>
                         <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/quotes/${quote.id}/edit`)}>
                           <Edit className="h-3 w-3" />
                         </Button>
                         <Button variant="ghost" size="sm" onClick={() => handleDeleteQuote(quote.id)}>
                           <Trash2 className="h-3 w-3 text-red-600" />
                         </Button>
                       </div>
                     </div>
                    <p className="text-sm font-medium">{formatCurrency(quote.total_cost)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
                {quotes.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{quotes.length - 3} more quotes
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center">No quotes yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client Portal Access Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Client Portal Access
          </CardTitle>
          <CardDescription>
            Manage login access and account settings for this client
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userAccount ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Account Status</Label>
                  <Badge className={`${getAccountStatusColor()} text-white w-fit`}>
                    {getAccountStatus()}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Login</Label>
                  <p className="text-sm text-muted-foreground">
                    {userAccount.last_login 
                      ? new Date(userAccount.last_login).toLocaleDateString() 
                      : 'Never logged in'
                    }
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Account Created</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(userAccount.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleResendInvite}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Invite
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleResetPassword}
                >
                  Reset Password
                </Button>
                <Button 
                  variant={userAccount.status === 'active' ? 'destructive' : 'default'}
                  size="sm"
                  onClick={handleDeactivateUser}
                >
                  {userAccount.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/admin/users/${userAccount.user_id}`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit User Profile
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">No Portal Access</h3>
                  <p className="text-sm text-muted-foreground">
                    This client does not have login access to the portal yet.
                  </p>
                </div>
                <Button 
                  variant="outline"
                  onClick={handleCreateUserAccount}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Portal Account
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Messages Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Messages
          </CardTitle>
          <CardDescription>
            Chat with {client.full_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <MessagesSection 
            clientId={client.id}
            title={`Messages with ${client.full_name}`}
          />
        </CardContent>
      </Card>

      {/* Lead History Section */}
      <ClientLeadHistory clientId={client.id} />

      {/* Edit Client Modal */}
      <Dialog open={showEditClient} onOpenChange={setShowEditClient}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client Information</DialogTitle>
            <DialogDescription>
              Update client details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">Full Name</Label>
              <Input
                id="client_name"
                value={clientForm.full_name}
                onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_email">Email</Label>
              <Input
                id="client_email"
                type="email"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_phone">Phone</Label>
              <Input
                id="client_phone"
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_address">Address</Label>
              <Textarea
                id="client_address"
                value={clientForm.address}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                placeholder="Enter address"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowEditClient(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditClient}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Quote Modal */}
      {editingQuote && (
        <Dialog open={!!editingQuote} onOpenChange={() => setEditingQuote(null)}>
          <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Quote {editingQuote.quote_number}</DialogTitle>
              <DialogDescription>
                Update quote details and products
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Product Selection Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProductSelector
                    selectedProducts={selectedProducts}
                    onSelectionChange={setSelectedProducts}
                  />
                </CardContent>
              </Card>

              {/* Quote Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_expires_at">Expiry Date</Label>
                    <Input
                      id="edit_expires_at"
                      type="date"
                      value={quoteForm.expires_at}
                      onChange={(e) => setQuoteForm({ ...quoteForm, expires_at: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_notes">Additional Notes</Label>
                    <Textarea
                      id="edit_notes"
                      value={quoteForm.notes}
                      onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                      placeholder="Additional notes or special instructions..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_product_details">Additional Product Details</Label>
                    <Textarea
                      id="edit_product_details"
                      value={quoteForm.product_details}
                      onChange={(e) => setQuoteForm({ ...quoteForm, product_details: e.target.value })}
                      placeholder="Any additional product details or customizations..."
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedProducts.reduce((total, item) => total + item.totalPrice, 0))}</span>
                  </div>
                </div>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => setEditingQuote(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateQuote}>
                    Update Quote
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
