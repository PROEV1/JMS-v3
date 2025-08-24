import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CalendarDays, MapPin, User, Phone, Mail, Package, CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type OrderStatusEnhanced = Database['public']['Enums']['order_status_enhanced'];

interface Order {
  id: string;
  order_number: string;
  status_enhanced: OrderStatusEnhanced;
  total_amount: number;
  amount_paid: number;
  job_address: string | null;
  scheduled_install_date: string | null;
  agreement_signed_at: string | null;
  created_at: string;
  survey_token: string | null;
  client: {
    id: string;
    full_name: string;
    email: string;
    address: string | null;
    postcode: string | null;
    phone?: string;
  } | null;
  quote: {
    id: string;
    quote_number: string;
    total_cost: number;
  } | null;
  engineer: {
    id: string;
    name: string;
    email: string;
  } | null;
  order_payments: Array<{
    id: string;
    amount: number;
    payment_type: string;
    status: string;
    paid_at: string | null;
    created_at: string;
  }>;
}

// Define the client journey steps
const getOrderSteps = (order: Order) => {
  const steps = [
    {
      id: 'survey',
      title: 'Survey',
      description: 'Complete property survey',
      status: 'current' as 'current' | 'pending' | 'completed',
      completed: false,
      icon: CheckCircle
    },
    {
      id: 'payment',
      title: 'Payment',
      description: 'Process payment',
      status: 'pending' as 'current' | 'pending' | 'completed',
      completed: false,
      icon: CreditCard
    },
    {
      id: 'agreement',
      title: 'Agreement',
      description: 'Sign installation agreement',
      status: 'pending' as 'current' | 'pending' | 'completed',
      completed: false,
      icon: CheckCircle
    },
    {
      id: 'booking',
      title: 'Booking',
      description: 'Schedule installation',
      status: 'pending' as 'current' | 'pending' | 'completed',
      completed: false,
      icon: CalendarDays
    },
    {
      id: 'scheduled',
      title: 'Scheduled',
      description: 'Installation confirmed',
      status: 'pending' as 'current' | 'pending' | 'completed',
      completed: false,
      icon: Clock
    },
    {
      id: 'complete',
      title: 'Complete',
      description: 'Installation finished',
      status: 'pending' as 'current' | 'pending' | 'completed',
      completed: false,
      icon: CheckCircle
    }
  ];

  // Update step status based on order status
  const status = order.status_enhanced;
  
  // Survey step
  if (['awaiting_survey_submission', 'survey_rework_requested'].includes(status)) {
    steps[0].status = 'current';
  } else if (['awaiting_survey_review'].includes(status)) {
    steps[0].status = 'current';
  } else {
    steps[0].completed = true;
    steps[0].status = 'completed';
  }

  // Payment step
  if (status === 'awaiting_payment') {
    steps[1].status = 'current';
  } else if (order.amount_paid >= order.total_amount) {
    steps[1].completed = true;
    steps[1].status = 'completed';
  }

  // Agreement step
  if (status === 'awaiting_agreement') {
    steps[2].status = 'current';
  } else if (order.agreement_signed_at) {
    steps[2].completed = true;
    steps[2].status = 'completed';
  }

  // Booking/Scheduling steps
  if (['awaiting_install_booking', 'date_offered', 'date_accepted', 'date_rejected', 'offer_expired'].includes(status)) {
    steps[3].status = 'current';
  } else if (order.scheduled_install_date) {
    steps[3].completed = true;
    steps[3].status = 'completed';
    
    if (status === 'scheduled') {
      steps[4].status = 'current';
    } else if (['in_progress', 'install_completed_pending_qa', 'completed'].includes(status)) {
      steps[4].completed = true;
      steps[4].status = 'completed';
    }
  }

  // Complete step
  if (status === 'completed') {
    steps[5].completed = true;
    steps[5].status = 'completed';
  } else if (['in_progress', 'install_completed_pending_qa'].includes(status)) {
    steps[5].status = 'current';
  }

  return steps;
};

export default function ClientOrderDetail() {
  const { id: orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const fetchOrder = async () => {
    if (!orderId) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          clients(
            id, 
            full_name, 
            email, 
            address, 
            postcode, 
            phone
          ),
          quotes(
            id,
            quote_number,
            total_cost
          ),
          engineers(
            id,
            name,
            email
          ),
          order_payments(
            id,
            amount,
            payment_type,
            status,
            paid_at,
            created_at
          )
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Order not found');

      setOrder({
        ...data,
        client: data.clients || null,
        quote: data.quotes || null,
        engineer: data.engineers || null,
        order_payments: data.order_payments || []
      } as Order);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: "Error",
        description: "Failed to load order details",
        variant: "destructive",
      });
      navigate('/client/orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSurveyStart = () => {
    if (order?.survey_token) {
      navigate(`/survey/${order.survey_token}`);
    }
  };

  const handlePayment = async () => {
    if (!order) return;
    
    const outstandingAmount = order.total_amount - order.amount_paid;
    if (outstandingAmount <= 0) return;

    try {
      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body: {
          order_id: order.id,
          amount: outstandingAmount,
          payment_type: 'balance'
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      toast({
        title: "Payment Error",
        description: "Failed to initiate payment",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Loading order details...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-600">Order not found</div>
      </div>
    );
  }

  const steps = getOrderSteps(order);
  const currentStepIndex = steps.findIndex(step => step.status === 'current');
  const completedSteps = steps.filter(step => step.completed).length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">Order {order.order_number}</h1>
          <p className="text-muted-foreground">
            Created {format(new Date(order.created_at), 'PPP')}
          </p>
        </div>
        <Badge variant={order.status_enhanced === 'completed' ? 'default' : 'secondary'}>
          {order.status_enhanced?.replace(/_/g, ' ').toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Progress Steps */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Installation Progress</CardTitle>
              <CardDescription>
                {completedSteps} of {steps.length} steps completed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress value={progressPercentage} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  {Math.round(progressPercentage)}% Complete
                </p>
              </div>

              {/* Step Navigation */}
              <div className="space-y-4">
                {steps.map((step, index) => {
                  const IconComponent = step.icon;
                  const isActive = step.status === 'current';
                  const isCompleted = step.completed;
                  
                  return (
                    <div key={step.id} className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      isActive ? 'bg-primary/10 border border-primary/20' : 
                      isCompleted ? 'bg-green-50 border border-green-200' : 
                      'bg-gray-50'
                    }`}>
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        isCompleted ? 'bg-green-500 text-white' :
                        isActive ? 'bg-primary text-white' :
                        'bg-gray-300 text-gray-600'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${
                          isActive ? 'text-primary' : 
                          isCompleted ? 'text-green-700' : 
                          'text-gray-600'
                        }`}>
                          {step.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                        
                        {/* Action buttons for current steps */}
                        {isActive && (
                          <div className="mt-2">
                            {step.id === 'survey' && (
                              <Button size="sm" onClick={handleSurveyStart} className="w-full">
                                Start Survey
                              </Button>
                            )}
                            {step.id === 'payment' && order.amount_paid < order.total_amount && (
                              <Button size="sm" onClick={handlePayment} className="w-full">
                                Make Payment
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">£{order.total_amount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-2xl font-bold text-green-600">£{order.amount_paid}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-2xl font-bold text-orange-600">£{order.total_amount - order.amount_paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Information */}
          {order.client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium">{order.client.full_name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {order.client.email}
                    </div>
                    {order.client.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {order.client.phone}
                      </div>
                    )}
                  </div>
                  {order.job_address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div className="text-sm">
                        <p className="font-medium">Installation Address</p>
                        <p className="text-muted-foreground">{order.job_address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Installation Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Installation Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.scheduled_install_date ? (
                <div>
                  <p className="font-medium">Scheduled Date</p>
                  <p className="text-muted-foreground">
                    {format(new Date(order.scheduled_install_date), 'PPP')}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <p>Installation date will be scheduled after survey and payment completion</p>
                </div>
              )}
              
              {order.engineer && (
                <div>
                  <p className="font-medium">Assigned Engineer</p>
                  <p className="text-muted-foreground">{order.engineer.name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          {order.order_payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.order_payments.map((payment) => (
                    <div key={payment.id} className="border-b pb-2 last:border-b-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">£{payment.amount}</span>
                        <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                          {payment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {payment.payment_type} • {format(new Date(payment.created_at), 'PPP')}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}