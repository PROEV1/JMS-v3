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

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Quotes</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{quotes.filter(q => q.status === 'sent').length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orders.filter(o => o.status !== 'completed').length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  £{payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quotes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Quotes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No quotes found</p>
              ) : (
                <div className="space-y-4">
                  {quotes.slice(0, 5).map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{quote.quote_number}</p>
                          <p className="text-sm text-muted-foreground">
                            Created: {new Date(quote.created_at).toLocaleDateString()}
                          </p>
                          {quote.expires_at && (
                            <p className="text-sm text-muted-foreground">
                              Expires: {new Date(quote.expires_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Badge className={getStatusColor(quote.status)}>
                          {formatStatus(quote.status)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">£{quote.total_cost.toLocaleString()}</p>
                          {quote.deposit_required && (
                            <p className="text-sm text-muted-foreground">
                              Deposit: £{quote.deposit_required.toLocaleString()}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          {quote.is_shareable && quote.share_token && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/quote/${quote.share_token}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          )}
                          
                          {quote.status === 'sent' && quote.deposit_required && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handlePayDeposit(quote.id, quote.deposit_required!)}
                              >
                                <CreditCard className="h-4 w-4 mr-1" />
                                Pay Deposit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePayBalance(quote.id, quote.total_cost)}
                              >
                                Pay Full Amount
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orders Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No orders found</p>
              ) : (
                <div className="space-y-4">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{order.order_number}</p>
                          <p className="text-sm text-muted-foreground">
                            Created: {new Date(order.created_at).toLocaleDateString()}
                          </p>
                          {order.scheduled_install_date && (
                            <p className="text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              Scheduled: {new Date(order.scheduled_install_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Badge className={getStatusColor(order.status_enhanced)}>
                          {formatStatus(order.status_enhanced)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">£{order.total_amount.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">
                            Paid: £{order.amount_paid.toLocaleString()}
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/order/${order.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          
                          {order.amount_paid < order.total_amount && (
                            <Button
                              size="sm"
                              onClick={() => handlePayOrder(order.id, order.total_amount - order.amount_paid)}
                            >
                              <CreditCard className="h-4 w-4 mr-1" />
                              Pay Balance
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Messages Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Chat with our support team</p>
                <Button 
                  onClick={() => navigate('/client/messages')}
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  Open Messages
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Recent Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No payments found</p>
              ) : (
                <div className="space-y-4">
                  {payments.slice(0, 5).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">£{payment.amount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.payment_type} • {new Date(payment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={getStatusColor(payment.status)}>
                        {formatStatus(payment.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}
