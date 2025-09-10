import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showErrorToast, showSuccessToast } from '@/utils/apiErrorHandler';
import { normalizePostcode } from '@/utils/postcodeUtils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { User, Mail, Phone, MapPin, Calendar, Save, Edit2, X, FileText, Package } from 'lucide-react';
import { PortalAccessPanel } from './PortalAccessPanel';
import { WhatsAppChat } from './WhatsAppChat';

interface Client {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  user_id: string | null;
  updated_at?: string;
}

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  total_cost: number;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  status_enhanced: string;
  total_amount: number;
  amount_paid: number;
  scheduled_install_date: string | null;
}

interface ClientProfileProps {
  clientId: string;
  onClose?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ 
  clientId, 
  onClose,
  showBackButton = false,
  onBack
}) => {
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClient();
    loadQuotes();
    loadOrders();
  }, [clientId]);

  const loadClient = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) {
        console.error('Error fetching client:', error);
        showErrorToast('Failed to load client');
      } else {
        // Ensure all required fields are present with defaults
        const clientData = {
          ...data,
          postcode: (data as any).postcode || null
        };
        setClient(clientData);
        setEditData(clientData);
      }
    } catch (error) {
      console.error('Error loading client:', error);
      showErrorToast('Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  const loadQuotes = async () => {
    setQuotesLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, status, total_cost, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching quotes:', error);
        showErrorToast('Failed to load quotes');
      } else {
        setQuotes(data || []);
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
      showErrorToast('Failed to load quotes');
    } finally {
      setQuotesLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status_enhanced, total_amount, amount_paid, scheduled_install_date')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        showErrorToast('Failed to load orders');
      } else {
        setOrders(data || []);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      showErrorToast('Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      // Only send editable fields
      const updatePayload = {
        full_name: editData.full_name,
        email: editData.email,
        phone: editData.phone,
        address: editData.address,
        postcode: normalizePostcode(editData.postcode || '') || null
      };

      const { error } = await supabase
        .from('clients')
        .update(updatePayload)
        .eq('id', clientId);

      if (error) {
        console.error('Error updating client:', error);
        showErrorToast('Failed to update client');
      } else {
        showSuccessToast('Client updated successfully');
        setIsEditing(false);
        loadClient();
      }
    } catch (error) {
      console.error('Error updating client:', error);
      showErrorToast('Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Client not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              ← Back
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold">{client.full_name}</h2>
            <p className="text-muted-foreground">{client.email}</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Client Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Client Information
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Full Name</label>
                      <Input
                        value={editData.full_name as string}
                        onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input
                        value={editData.email as string}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        placeholder="Email address"
                        type="email"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Phone</label>
                      <Input
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        placeholder="Phone number"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Postcode</label>
                      <Input
                        value={editData.postcode || ''}
                        onChange={(e) => setEditData({ ...editData, postcode: e.target.value.toUpperCase() })}
                        placeholder="Postcode"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Address</label>
                    <Textarea
                      value={editData.address || ''}
                      onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                      placeholder="Full address"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveChanges} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{client.phone}</span>
                      </div>
                    )}
                  </div>
                  {client.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-sm">{client.address}</span>
                    </div>
                  )}
                  {client.postcode && (
                    <div>
                      <Badge variant="outline">{client.postcode}</Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Created {new Date(client.created_at).toLocaleDateString()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quotes ({quotes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quotesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : quotes.length > 0 ? (
                <div className="space-y-3">
                  {quotes.map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{quote.quote_number}</span>
                          <Badge variant="outline">{quote.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Created {new Date(quote.created_at).toLocaleDateString()} • Total: £{quote.total_cost.toFixed(2)}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/quotes/${quote.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No quotes available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Orders ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : orders.length > 0 ? (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{order.order_number}</span>
                          <Badge variant="outline">{order.status_enhanced.replace(/_/g, ' ')}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.scheduled_install_date && (
                            <>Scheduled: {new Date(order.scheduled_install_date).toLocaleDateString()} • </>
                          )}
                          Paid: £{order.amount_paid.toFixed(2)} / £{order.total_amount.toFixed(2)}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No orders available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Portal Access, Messages & Actions */}
        <div className="space-y-6">
          {/* Portal Access Panel */}
          <PortalAccessPanel client={client} />

          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px]">
                <WhatsAppChat clientId={clientId} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="destructive" className="w-full">
                Delete Client
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
