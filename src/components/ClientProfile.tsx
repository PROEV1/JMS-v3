
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Mail, Phone, MapPin, User, Calendar, FileText, Wrench } from 'lucide-react';

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
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
  status: string;
  total_amount: number;
  created_at: string;
}

interface Project {
  id: string;
  project_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  scheduled_date: string | null;
  notes: string | null;
  installer_id: string | null;
  quote_id: string | null;
  client_id: string;
  // Optional field that might not exist
  installer_name?: string;
}

export const ClientProfile: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (clientId) {
      fetchClientData();
    }
  }, [clientId]);

  const fetchClientData = async () => {
    try {
      setLoading(true);

      // Fetch client details
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;

      setClient(clientData);
      setEditForm({
        full_name: clientData.full_name || '',
        email: clientData.email || '',
        phone: clientData.phone || '',
        address: clientData.address || ''
      });

      // Fetch quotes
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('id, quote_number, status, total_cost, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;
      setQuotes(quotesData || []);

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch projects with optional installer name
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          project_name,
          status,
          created_at,
          updated_at,
          scheduled_date,
          notes,
          installer_id,
          quote_id,
          client_id
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;
      
      // Transform projects data to match our interface
      const transformedProjects: Project[] = (projectsData || []).map(project => ({
        ...project,
        installer_name: undefined // We don't have installer name from the query, so set as undefined
      }));
      
      setProjects(transformedProjects);

    } catch (error) {
      console.error('Error fetching client data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch client data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClient = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone || null,
          address: editForm.address || null
        })
        .eq('id', clientId)
        .select()
        .single();

      if (error) throw error;

      setClient(data);
      setEditMode(false);
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: "Error",
        description: "Failed to update client",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-4">Client not found</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Client Details
          </CardTitle>
          <Button
            variant="outline"
            onClick={() => editMode ? handleUpdateClient() : setEditMode(true)}
          >
            {editMode ? 'Save Changes' : 'Edit Client'}
          </Button>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={handleUpdateClient}>
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{client.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{client.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 md:col-span-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Client since: {new Date(client.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quotes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quotes ({quotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="text-muted-foreground">No quotes found</p>
          ) : (
            <div className="space-y-3">
              {quotes.map((quote) => (
                <div key={quote.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{quote.quote_number}</span>
                    <Badge className={getStatusColor(quote.status)}>
                      {quote.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">£{quote.total_cost.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Orders ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-muted-foreground">No orders found</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{order.order_number}</span>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">£{order.total_amount.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects */}
      {projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projects ({projects.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{project.project_name}</span>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    {project.scheduled_date && (
                      <div className="text-sm text-muted-foreground">
                        Scheduled: {new Date(project.scheduled_date).toLocaleDateString()}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
