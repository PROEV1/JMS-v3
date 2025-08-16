import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BrandPage, BrandContainer } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { FileText, Wrench, CreditCard, Calendar, Eye, Download, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  total_cost: number;
  created_at: string;
  expires_at: string | null;
  is_shareable: boolean;
  share_token: string | null;
  // Optional fields that might not exist in database
  deposit_required?: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  status_enhanced: string;
  total_amount: number;
  amount_paid: number;
  created_at: string;
  scheduled_install_date: string | null;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  payment_type: string;
  created_at: string;
  quote_id: string | null;
  stripe_session_id: string | null;
  // Fields that don't exist in database but are expected by interface
  method?: string;
  amount_paid?: number;
  paid_on?: string;
}

export default function ClientDashboard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Get client record
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (clientError) {
        console.error('Error fetching client:', clientError);
        return;
      }

      // Fetch quotes with default values for missing fields
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;
      
      // Transform quotes to include default deposit_required
      const transformedQuotes: Quote[] = (quotesData || []).map(quote => ({
        ...quote,
        deposit_required: quote.total_cost * 0.25, // Default to 25% of total cost
      }));
      
      setQuotes(transformedQuotes);

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch payments - convert to our Payment interface
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;
      
      // Transform payments to match interface (though type conversion may still show warnings)
      const transformedPayments = (paymentsData || []).map(payment => ({
        ...payment,
        method: payment.payment_type, // Map payment_type to method
        amount_paid: payment.amount,  // Map amount to amount_paid
        paid_on: payment.created_at   // Map created_at to paid_on
      })) as Payment[];
      
      setPayments(transformedPayments);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
        return 'bg-red-100 text-red-800';
      case 'awaiting_payment':
        return 'bg-red-100 text-red-800';
      case 'awaiting_agreement':
        return 'bg-orange-100 text-orange-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handlePayDeposit = async (quoteId: string, amount: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body: {
          quote_id: quoteId,
          amount: amount,
          payment_type: 'deposit'
        }
      });

      if (error) throw error;

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      toast({
        title: "Error",
        description: "Failed to initiate payment",
        variant: "destructive",
      });
    }
  };

  const handlePayBalance = async (quoteId: string, amount: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body: {
          quote_id: quoteId,
          amount: amount,
          payment_type: 'balance'
        }
      });

      if (error) throw error;

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      toast({
        title: "Error",
        description: "Failed to initiate payment",
        variant: "destructive",
      });
    }
  };

  const handlePayOrder = async (orderId: string, amount: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body: {
          order_id: orderId,
          amount: amount,
          payment_type: 'order_payment'
        }
      });

      if (error) throw error;

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      toast({
        title: "Error",
        description: "Failed to initiate payment",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <BrandPage>
        <BrandContainer>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          </div>
        </BrandContainer>
      </BrandPage>
    );
  }

  return (
    <BrandPage>
      <BrandContainer>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">My Dashboard</h1>

          {/* Navigation Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/client/quotes')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quotes</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{quotes.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {quotes.filter(q => q.status === 'sent').length} pending
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/client/orders')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Orders</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orders.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {orders.filter(o => o.status !== 'completed').length} active
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/client/messages')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages</CardTitle>
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Chat with support
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/client/payments')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Payments</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  £{payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total paid
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/client/documents')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Documents</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload & view files
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/client/profile')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profile</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <Eye className="h-6 w-6" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage account
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="h-16 flex flex-col gap-2"
                  onClick={() => navigate('/client/quotes')}
                >
                  <FileText className="h-5 w-5" />
                  <span>View All Quotes</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-16 flex flex-col gap-2"
                  onClick={() => navigate('/client/orders')}
                >
                  <Wrench className="h-5 w-5" />
                  <span>View All Orders</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-16 flex flex-col gap-2"
                  onClick={() => navigate('/client/messages')}
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>Contact Support</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-16 flex flex-col gap-2"
                  onClick={() => navigate('/client/date-blocking')}
                >
                  <Calendar className="h-5 w-5" />
                  <span>Manage Availability</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}
