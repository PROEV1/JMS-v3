import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, FileText, Briefcase, Mail, Eye, Send, Trash2, MessageSquare, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ProSpacesLogo } from '@/components/ProSpacesLogo';

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  user_id: string;
}

interface DashboardStats {
  total_clients: number;
  total_quotes: number;
  total_projects: number;
  pending_quotes: number;
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_clients: 0,
    total_quotes: 0,
    total_projects: 0,
    pending_quotes: 0
  });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [selectedClientCredentials, setSelectedClientCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  
  const [newClient, setNewClient] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Load stats
      const [quotesResult, projectsResult] = await Promise.all([
        supabase.from('quotes').select('id, status'),
        supabase.from('projects').select('id')
      ]);

      setClients(clientsData || []);
      setStats({
        total_clients: clientsData?.length || 0,
        total_quotes: quotesResult.data?.length || 0,
        total_projects: projectsResult.data?.length || 0,
        pending_quotes: quotesResult.data?.filter(q => q.status === 'sent').length || 0
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createClient = async () => {
    try {
      const authToken = (await supabase.auth.getSession()).data.session?.access_token;
      if (!authToken) {
        throw new Error('No authentication token');
      }

      // Call admin-create-client function
      const response = await fetch(`https://jttogvpjfeegbkpturey.supabase.co/functions/v1/admin-create-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(newClient),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create client');
      }

      console.log('Client created successfully:', data);

      // Now send the invite email
      const siteUrl = window.location.origin;
      const inviteResponse = await supabase.functions.invoke('send-client-invite', {
        body: {
          clientId: data.client.id,
          clientName: data.client.full_name,
          clientEmail: data.client.email,
          temporaryPassword: data.temporaryPassword,
          siteUrl: siteUrl
        }
      });

      if (inviteResponse.error) {
        console.error('Error sending invite email:', inviteResponse.error);
        toast({
          title: "Warning",
          description: "Client created but failed to send welcome email. You can resend it from the client list.",
          variant: "destructive",
        });
      } else {
        console.log('Invite email sent successfully');
        toast({
          title: "Success",
          description: "Client created and welcome email sent successfully",
        });
      }

      // Store credentials for viewing
      setSelectedClientCredentials({
        email: data.client.email,
        password: data.temporaryPassword
      });

      setNewClient({
        full_name: '',
        email: '',
        phone: '',
        address: ''
      });
      setShowCreateModal(false);
      loadDashboardData();
      
      // Show credentials modal
      setShowCredentialsModal(true);

    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create client",
        variant: "destructive",
      });
    }
  };

  const resendInviteEmail = async (client: Client) => {
    try {
      // Generate a new temporary password for resending
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
      
      // Reset the user's password first
      const authToken = (await supabase.auth.getSession()).data.session?.access_token;
      if (!authToken) {
        throw new Error('No authentication token');
      }

      // Update the user's password using admin privileges
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        client.user_id,
        { password: tempPassword }
      );

      if (updateError) {
        throw updateError;
      }

      // Send the invite email
      const siteUrl = window.location.origin;
      const { error: inviteError } = await supabase.functions.invoke('send-client-invite', {
        body: {
          clientId: client.id,
          clientName: client.full_name,
          clientEmail: client.email,
          temporaryPassword: tempPassword,
          siteUrl: siteUrl
        }
      });

      if (inviteError) {
        throw inviteError;
      }

      // Show credentials
      setSelectedClientCredentials({
        email: client.email,
        password: tempPassword
      });
      setShowCredentialsModal(true);

      toast({
        title: "Success",
        description: "Invite email resent successfully",
      });

    } catch (error) {
      console.error('Error resending invite:', error);
      toast({
        title: "Error",
        description: "Failed to resend invite email",
        variant: "destructive",
      });
    }
  };

  const deleteClient = async (client: Client) => {
    if (!confirm(`Are you sure you want to delete ${client.full_name}? This will permanently delete the client and all associated data.`)) {
      return;
    }

    try {
      const authToken = (await supabase.auth.getSession()).data.session?.access_token;
      if (!authToken) {
        throw new Error('No authentication token');
      }

      // Call admin-delete-client function
      console.log('Calling delete function with:', { clientId: client.id, userId: client.user_id });
      
      const response = await fetch(`https://jttogvpjfeegbkpturey.supabase.co/functions/v1/admin-delete-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          clientId: client.id,
          userId: client.user_id
        }),
      });

      console.log('Delete response status:', response.status);
      const data = await response.json();
      console.log('Delete response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete client');
      }

      toast({
        title: "Success",
        description: "Client deleted successfully",
      });

      loadDashboardData();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete client",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* ProSpaces Header */}
      <div className="flex items-center justify-between mb-8">
        <ProSpacesLogo variant="main" size="lg" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">ProSpaces Admin Portal</p>
          <p className="text-xs text-muted-foreground">Management Dashboard</p>
        </div>
      </div>

      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl heading-large">Admin Dashboard</h1>
          <p className="text-muted-foreground body-text">Manage clients, quotes, and projects</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => navigate('/admin/orders')} variant="outline">
            <Package className="h-4 w-4 mr-2" />
            Orders
          </Button>
          <Button onClick={() => navigate('/admin/products')} variant="outline">
            <Package className="h-4 w-4 mr-2" />
            Products
          </Button>
          <Button onClick={() => navigate('/admin/messages')} variant="outline">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </Button>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Client</DialogTitle>
                <DialogDescription>Add a new client to the system</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={newClient.full_name}
                    onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
                    placeholder="Client's full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="client@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address (Optional)</Label>
                  <Textarea
                    id="address"
                    value={newClient.address}
                    onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                    placeholder="Client's address"
                  />
                </div>
                <Button 
                  onClick={createClient} 
                  disabled={!newClient.full_name || !newClient.email}
                  className="w-full"
                >
                  Create Client
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-border hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-secondary/20 rounded-full border border-secondary/30">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-semibold heading-semibold">{stats.total_clients}</p>
                <p className="text-sm text-muted-foreground body-text">Total Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-accent/20 rounded-full border border-accent/30">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-semibold heading-semibold">{stats.total_quotes}</p>
                <p className="text-sm text-muted-foreground body-text">Total Quotes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-muted/40 rounded-full border border-muted">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-semibold heading-semibold">{stats.total_projects}</p>
                <p className="text-sm text-muted-foreground body-text">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-yellow-100 rounded-full border border-yellow-200">
                <FileText className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-3xl font-semibold heading-semibold">{stats.pending_quotes}</p>
                <p className="text-sm text-muted-foreground body-text">Pending Quotes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card className="border-border">
        <CardHeader className="bg-muted/30">
          <CardTitle className="heading-semibold">Recent Clients</CardTitle>
          <CardDescription className="body-text">Manage your client accounts</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.full_name}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.phone || '-'}</TableCell>
                  <TableCell>{new Date(client.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/client/${client.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendInviteEmail(client)}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Resend Invite
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteClient(client)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No clients found. Create your first client to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Login Credentials Modal */}
      <Dialog open={showCredentialsModal} onOpenChange={setShowCredentialsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client Login Credentials</DialogTitle>
            <DialogDescription>
              Share these login credentials with your client. They should change their password after first login.
            </DialogDescription>
          </DialogHeader>
          {selectedClientCredentials && (
            <div className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg border">
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium">Email:</Label>
                    <p className="text-sm font-mono bg-background p-2 rounded border mt-1">
                      {selectedClientCredentials.email}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Temporary Password:</Label>
                    <p className="text-sm font-mono bg-background p-2 rounded border mt-1">
                      {selectedClientCredentials.password}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>• The client will receive these credentials via email</p>
                <p>• They should change their password after first login</p>
                <p>• Login page: {window.location.origin}/auth</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
