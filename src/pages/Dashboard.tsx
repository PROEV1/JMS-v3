import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clock, AlertCircle, FileText, MessageSquare, Upload, Mail } from 'lucide-react';

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  product_details: string;
  total_cost: number;
  expires_at: string;
  created_at: string;
}

interface Project {
  id: string;
  project_name?: string;
  order_number?: string;
  status: string;
  scheduled_date?: string;
  created_at: string;
  quote?: {
    quote_number: string;
  };
}

interface Profile {
  full_name: string;
  role: string;
}

interface Client {
  id: string;
  full_name: string;
  email: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuickMessageModal, setShowQuickMessageModal] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [selectedQuoteForMessage, setSelectedQuoteForMessage] = useState<Quote | null>(null);
  const [selectedProjectForMessage, setSelectedProjectForMessage] = useState<Project | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log('Dashboard: Component loaded, user:', user);
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('user_id', user?.id)
        .single();

      setProfile(profileData);

      // Fetch client data
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, full_name, email')
        .eq('user_id', user?.id)
        .single();

      setClient(clientData);

      // Fetch quotes - either all for admin or client-specific
      let quotesQuery = supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          status,
          product_details,
          total_cost,
          expires_at,
          created_at
        `);

      if (profileData?.role !== 'admin' && clientData) {
        quotesQuery = quotesQuery.eq('client_id', clientData.id);
      }

      const { data: quotesData } = await quotesQuery.order('created_at', { ascending: false });

      setQuotes(quotesData || []);

      // Load orders (renamed from projects for clients)
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          created_at,
          quote:quotes(quote_number)
        `);

      if (profileData?.role !== 'admin' && clientData) {
        ordersQuery = ordersQuery.eq('client_id', clientData.id);
      }

      const { data: ordersData } = await ordersQuery.order('created_at', { ascending: false });

      setProjects(ordersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const acceptQuote = async (quoteId: string) => {
    try {
      // Update quote status to accepted
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ 
          status: 'accepted', 
          accepted_at: new Date().toISOString() 
        })
        .eq('id', quoteId);

      if (quoteError) throw quoteError;

      // Get the updated quote with client details
      const { data: quote, error: fetchError } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('id', quoteId)
        .single();

      if (fetchError) throw fetchError;

      // Create order from accepted quote
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          client_id: quote.client_id,
          quote_id: quote.id,
          total_amount: quote.total_cost,
          deposit_amount: quote.deposit_required || 0,
          job_address: quote.client.address || null,
          status: 'awaiting_payment'
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      toast({
        title: "Quote Accepted!",
        description: "Your order has been created. Redirecting to order details...",
      });

      // Refresh data and redirect to order
      fetchData();
      
      // Redirect to order page after a short delay
      setTimeout(() => {
        window.location.href = `/order/${order.id}`;
      }, 1500);

    } catch (error) {
      console.error('Error accepting quote:', error);
      toast({
        title: "Error",
        description: "Failed to accept quote",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      sent: { label: 'Sent', variant: 'secondary' as const, icon: Clock },
      viewed: { label: 'Viewed', variant: 'outline' as const, icon: Clock },
      accepted: { label: 'Accepted', variant: 'default' as const, icon: CheckCircle },
      declined: { label: 'Declined', variant: 'destructive' as const, icon: AlertCircle },
      quote_accepted: { label: 'Quote Accepted', variant: 'default' as const, icon: CheckCircle },
      survey_complete: { label: 'Survey Complete', variant: 'secondary' as const, icon: CheckCircle },
      install_booked: { label: 'Install Booked', variant: 'outline' as const, icon: Clock },
      in_progress: { label: 'In Progress', variant: 'default' as const, icon: Clock },
      completed: { label: 'Completed', variant: 'secondary' as const, icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status, 
      variant: 'outline' as const, 
      icon: Clock 
    };
    
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-primary/5 rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {profile?.full_name || user?.email}!
        </h1>
        <p className="text-muted-foreground">
          Track your quotes and projects in one place.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Quotes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quotes.filter(q => q.status === 'sent' || q.status === 'viewed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.filter(p => p.status !== 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Projects</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.filter(p => p.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Quotes */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Quotes</CardTitle>
          <CardDescription>Your latest quotes and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No quotes available</p>
          ) : (
            <div className="space-y-4">
              {quotes.slice(0, 3).map((quote) => (
                <div key={quote.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{quote.quote_number}</span>
                      {getStatusBadge(quote.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{quote.product_details}</p>
                    <p className="text-sm font-medium">£{quote.total_cost.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {quote.status === 'sent' || quote.status === 'viewed' ? (
                      <Button size="sm" onClick={() => acceptQuote(quote.id)}>
                        Accept Quote
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => {
                      console.log('Quote Message button clicked!', quote);
                      setSelectedQuoteForMessage(quote);
                      setShowQuickMessageModal(true);
                    }}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Message
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Orders */}
      <Card>
        <CardHeader>
          <CardTitle>My Orders</CardTitle>
          <CardDescription>Track your accepted quotes and installations</CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No orders yet</p>
          ) : (
            <div className="space-y-4">
              {projects.filter(p => p.status !== 'completed').map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                     onClick={() => window.location.href = `/order/${order.id}`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Order {order.order_number || `ORD-${order.id.slice(0, 8)}`}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Files
                    </Button>
                    <Button variant="outline" size="sm" onClick={(e) => {
                      e.stopPropagation();
                      console.log('Order Message button clicked!', order);
                      setSelectedProjectForMessage(order);
                      setShowQuickMessageModal(true);
                    }}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Message
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Message Modal */}
      {showQuickMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Send Message 
              {selectedQuoteForMessage && ` - Quote ${selectedQuoteForMessage.quote_number}`}
              {selectedProjectForMessage && ` - Order ${selectedProjectForMessage.order_number || selectedProjectForMessage.id.slice(0, 8)}`}
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="quick-message">Message</Label>
                <Textarea
                  id="quick-message"
                  value={quickMessage}
                  onChange={(e) => setQuickMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                />
              </div>
              <div className="flex space-x-3">
                <Button 
                  onClick={async () => {
                    if (!quickMessage.trim()) {
                      toast({
                        title: "Error",
                        description: "Please enter a message",
                        variant: "destructive",
                      });
                      return;
                    }

                    try {
                      const authToken = (await supabase.auth.getSession()).data.session?.access_token;
                      if (!authToken) {
                        throw new Error('No authentication token');
                      }

                      const response = await fetch(`https://jttogvpjfeegbkpturey.supabase.co/functions/v1/send-message`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${authToken}`,
                        },
                        body: JSON.stringify({
                          content: quickMessage,
                          clientId: client?.id,
                          quoteId: selectedQuoteForMessage?.id,
                          projectId: selectedProjectForMessage?.id
                        }),
                      });

                      const data = await response.json();

                      if (!response.ok) {
                        throw new Error(data.error || 'Failed to send message');
                      }

                      toast({
                        title: "Success",
                        description: "Message sent successfully!",
                      });

                      setQuickMessage('');
                      setSelectedQuoteForMessage(null);
                      setSelectedProjectForMessage(null);
                      setShowQuickMessageModal(false);
                    } catch (error) {
                      console.error('Error sending message:', error);
                      toast({
                        title: "Error",
                        description: "Failed to send message",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="flex-1"
                >
                  Send Message
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowQuickMessageModal(false);
                    setQuickMessage('');
                    setSelectedQuoteForMessage(null);
                    setSelectedProjectForMessage(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}