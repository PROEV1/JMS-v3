import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BrandPage, BrandContainer } from '@/components/brand';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Wrench, Eye, CreditCard, Calendar, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Order {
  id: string;
  order_number: string;
  status: string;
  status_enhanced: string;
  total_amount: number;
  amount_paid: number;
  created_at: string;
  scheduled_install_date: string | null;
  job_type?: 'installation' | 'assessment' | 'service_call';
}

export default function ClientOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (clientError) {
        console.error('Error fetching client:', clientError);
        return;
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'awaiting_payment':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'awaiting_agreement':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'awaiting_install_booking':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'scheduled':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'install_completed_pending_qa':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getStepNumber = (status: string) => {
    const steps = {
      'awaiting_payment': 1,
      'awaiting_agreement': 2,
      'awaiting_install_booking': 3,
      'scheduled': 4,
      'in_progress': 5,
      'install_completed_pending_qa': 6,
      'completed': 7
    };
    return steps[status as keyof typeof steps] || 1;
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
        window.open(data.url, '_blank');
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
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/client')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">My Orders</h1>
            <Badge variant="secondary">{orders.length}</Badge>
          </div>

          {orders.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No orders yet</h3>
                <p className="text-muted-foreground">Your orders will appear here once you accept a quote.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold text-lg">{order.order_number}</h3>
                          {order.job_type && (
                            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                              {order.job_type.charAt(0).toUpperCase() + order.job_type.slice(1).replace('_', ' ')}
                            </Badge>
                          )}
                          <Badge className={getStatusColor(order.status_enhanced)}>
                            Step {getStepNumber(order.status_enhanced)}: {formatStatus(order.status_enhanced)}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Created: {new Date(order.created_at).toLocaleDateString()}</p>
                          {order.scheduled_install_date && (
                            <p className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Scheduled: {new Date(order.scheduled_install_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">£{order.total_amount.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">
                            Paid: £{order.amount_paid.toLocaleString()}
                          </p>
                          {order.amount_paid < order.total_amount && (
                            <p className="text-sm font-medium text-red-600">
                              Outstanding: £{(order.total_amount - order.amount_paid).toLocaleString()}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/client/orders/${order.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          
                          {order.amount_paid < order.total_amount && (
                            <Button
                              size="sm"
                              onClick={() => handlePayOrder(order.id, order.total_amount - order.amount_paid)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              Pay Balance
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center space-x-4">
                        {['Payment', 'Agreement', 'Booking', 'Scheduled', 'In Progress', 'QA', 'Complete'].map((step, index) => {
                          const stepNum = index + 1;
                          const currentStep = getStepNumber(order.status_enhanced);
                          const isCompleted = stepNum < currentStep;
                          const isCurrent = stepNum === currentStep;
                          
                          return (
                            <div key={step} className="flex items-center">
                              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                                isCompleted ? 'bg-green-500 text-white' :
                                isCurrent ? 'bg-primary text-white' :
                                'bg-gray-200 text-gray-600'
                              }`}>
                                {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : stepNum}
                              </div>
                              {index < 6 && (
                                <div className={`w-8 h-0.5 ${
                                  isCompleted ? 'bg-green-500' : 'bg-gray-200'
                                }`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </BrandContainer>
    </BrandPage>
  );
}