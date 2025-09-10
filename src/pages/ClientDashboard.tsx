import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BrandPage, BrandContainer } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { FileText, Wrench, CreditCard, Calendar, Eye, Download, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  quotes: number;
  orders: number;
  messages: number;
  payments: number;
  documents: number;
}

export default function ClientDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    quotes: 0,
    orders: 0,
    messages: 0,
    payments: 0,
    documents: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get client ID first
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (clientError || !clientData) {
        console.error('Error fetching client data:', clientError);
        return;
      }

      // Fetch quotes count
      const { count: quotesCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientData.id);

      // Fetch orders count  
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientData.id);

      // Fetch messages count
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientData.id);

      // Fetch payments sum from order_payments table - fix the query
      const { data: ordersForPayments } = await supabase
        .from('orders')
        .select('id')
        .eq('client_id', clientData.id);

      const orderIds = ordersForPayments?.map(order => order.id) || [];
      
      let totalPaid = 0;
      if (orderIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from('order_payments')
          .select('amount')
          .eq('status', 'paid')
          .in('order_id', orderIds);

        totalPaid = paymentsData?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
      }

      // Fetch documents count
      const { count: documentsCount } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientData.id);

      setStats({
        quotes: quotesCount || 0,
        orders: ordersCount || 0,
        messages: messagesCount || 0,
        payments: totalPaid,
        documents: documentsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                <div className="text-2xl font-bold">{stats.quotes}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total quotes
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
                <div className="text-2xl font-bold">{stats.orders}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total orders
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
                <div className="text-2xl font-bold">{stats.messages}</div>
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
                  £{stats.payments.toLocaleString()}
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
                <div className="text-2xl font-bold">{stats.documents}</div>
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
