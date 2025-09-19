import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin, User, Phone, Mail, Package, CreditCard, CheckCircle, Clock, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';
import { AgreementSigningModal } from '@/components/AgreementSigningModal';
import { OrderNotesSection } from '@/components/admin/sections/OrderNotesSection';

type OrderStatusEnhanced = Database['public']['Enums']['order_status_enhanced'];

interface Order {
  id: string;
  order_number: string;
  status_enhanced: OrderStatusEnhanced;
  total_amount: number;
  amount_paid: number;
  deposit_amount: number;
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

export default function EnhancedClientOrderView() {
  const { id: orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
      
      // Check for payment success/cancellation on page load
      const urlParams = new URLSearchParams(location.search);
      const paymentStatus = urlParams.get('payment');
      const sessionId = urlParams.get('session_id');

      if (paymentStatus === 'success' && sessionId) {
        verifyPayment(sessionId);
      } else if (paymentStatus === 'cancelled') {
        toast({
          title: "Payment Cancelled",
          description: "Your payment was cancelled",
          variant: "destructive",
        });
        // Clean up URL and localStorage
        window.history.replaceState({}, '', window.location.pathname);
        localStorage.removeItem('pending_payment_session');
        localStorage.removeItem('pending_payment_order');
      } else {
        // Check for fallback payment verification using localStorage
        const pendingSessionId = localStorage.getItem('pending_payment_session');
        const pendingOrderId = localStorage.getItem('pending_payment_order');
        
        if (pendingSessionId && pendingOrderId === orderId) {
          console.log('Checking fallback payment verification for session:', pendingSessionId);
          verifyPayment(pendingSessionId);
        }
      }
    }
  }, [orderId, location.search]);

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
          engineers!engineer_id(
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

  const verifyPayment = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { session_id: sessionId }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Payment Successful",
          description: `Payment of £${data.amount_paid} was processed successfully`,
        });
        
        // Clean up localStorage
        localStorage.removeItem('pending_payment_session');
        localStorage.removeItem('pending_payment_order');
        
        // Force refresh order data to get updated status
        await fetchOrder();
        
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      toast({
        title: "Payment Verification Error",
        description: "There was an issue verifying your payment. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const getCurrentStep = () => {
    if (!order) return { step: 1, title: 'Survey', description: 'Complete property survey' };

    const status = order.status_enhanced;
    
    if (status === 'awaiting_survey_submission') {
      return { step: 1, title: 'Survey', description: 'Complete property survey' };
    }
    
    if (status === 'survey_rework_requested') {
      return { step: 1, title: 'Survey', description: 'Rework required - update survey' };
    }
    
    // When survey is submitted/under review, it's completed from client perspective
    if (status === 'awaiting_survey_review') {
      return { step: 2, title: 'Survey Review', description: 'Survey submitted - being reviewed by our team' };
    }
    
    if (status === 'awaiting_payment') {
      return { step: 2, title: 'Make Payment', description: 'Make payment to move forward' };
    }
    
    if (status === 'awaiting_agreement') {
      return { step: 3, title: 'Sign Agreement', description: 'Sign to lock in your booking' };
    }
    
    if (['awaiting_install_booking', 'date_offered', 'date_accepted', 'date_rejected', 'offer_expired'].includes(status)) {
      return { step: 4, title: 'Awaiting Scheduling', description: 'We will be in touch within 24 hours' };
    }
    
    if (status === 'scheduled') {
      return { step: 5, title: 'Install Confirmed', description: "We'll confirm install shortly" };
    }
    
    return { step: 6, title: 'Complete', description: 'Installation finished' };
  };

  const getProgressSteps = () => {
    const currentStep = getCurrentStep().step;
    
    return [
      {
        number: 1,
        title: 'Survey',
        description: 'Complete property survey',
        icon: FileText,
        completed: currentStep > 1,
        active: currentStep === 1
      },
      {
        number: 2,
        title: 'Make Payment',
        description: 'Make payment to move forward',
        icon: CreditCard,
        completed: currentStep > 2,
        active: currentStep === 2
      },
      {
        number: 3,
        title: 'Sign Agreement',
        description: 'Sign to lock in your booking',
        icon: FileText,
        completed: currentStep > 3,
        active: currentStep === 3
      },
      {
        number: 4,
        title: 'Awaiting Scheduling',
        description: 'We will be in touch within 24 hours',
        icon: Clock,
        completed: currentStep > 4,
        active: currentStep === 4
      },
      {
        number: 5,
        title: 'Install Confirmed',
        description: "We'll confirm install shortly",
        icon: CheckCircle,
        completed: currentStep > 5,
        active: currentStep === 5
      }
    ];
  };

  const handleSurveyStart = () => {
    if (order?.survey_token) {
      navigate(`/survey/${order.survey_token}`);
    }
  };

  const handlePayment = async (type: 'deposit' | 'balance') => {
    if (!order) return;
    
    setProcessingPayment(true);
    
    try {
      let paymentAmount = 0;
      
      if (type === 'deposit') {
        paymentAmount = order.deposit_amount - order.amount_paid;
      } else {
        paymentAmount = order.total_amount - order.amount_paid;
      }

      if (paymentAmount <= 0) {
        toast({
          title: "Error",
          description: "No payment required",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body: {
          order_id: order.id,
          amount: paymentAmount,
          payment_type: type
        }
      });

      if (error) throw error;
      if (data?.url && data?.session_id) {
        // Store session_id for fallback verification
        localStorage.setItem('pending_payment_session', data.session_id);
        localStorage.setItem('pending_payment_order', order.id);
        
        // Redirect in same tab instead of opening new tab
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      toast({
        title: "Payment Error",
        description: "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleAgreementSigned = async () => {
    await fetchOrder();
  };

  const renderStepContent = () => {
    const currentStep = getCurrentStep();
    const status = order?.status_enhanced;
    
    if (currentStep.step === 1) {
      return (
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-red-700">Survey</h3>
                <p className="text-sm text-red-600">Complete property survey</p>
              </div>
            </div>
            <Button onClick={handleSurveyStart} className="bg-red-500 hover:bg-red-600">
              Start Survey
            </Button>
          </div>
        </div>
      );
    }
    
    if (currentStep.step === 2 && status === 'awaiting_survey_review') {
      return (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-700">Survey Under Review</h3>
                <p className="text-sm text-blue-600">Your survey has been submitted and is being reviewed by our team</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              We'll review your survey and contact you if any additional information is needed. 
              You'll be notified once the review is complete.
            </p>
          </div>
        </div>
      );
    }
    
    if (currentStep.step === 2) {
      const outstandingAmount = order?.total_amount ? order.total_amount - order.amount_paid : 0;
      const depositAmount = order?.deposit_amount || 0;
      
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Order Value:</p>
              <p className="text-xl font-bold">£{order?.total_amount?.toFixed(2)}</p>
            </div>
            {depositAmount > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Deposit Required:</p>
                <p className="text-xl font-bold">£{depositAmount.toFixed(2)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Amount Paid:</p>
              <p className="text-xl font-bold text-green-600">£{order?.amount_paid?.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">Outstanding:</p>
            <p className="text-3xl font-bold text-red-600">£{outstandingAmount.toFixed(2)}</p>
          </div>
          
          <Button 
            onClick={() => handlePayment(depositAmount > order!.amount_paid ? 'deposit' : 'balance')} 
            disabled={processingPayment || outstandingAmount <= 0}
            className="w-full bg-red-500 hover:bg-red-600"
            size="lg"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {depositAmount > order!.amount_paid 
              ? `Pay Deposit Now (£${depositAmount.toFixed(2)})` 
              : `Pay Balance Now (£${outstandingAmount.toFixed(2)})`
            }
          </Button>
        </div>
      );
    }
    
    if (currentStep.step === 3) {
      return (
        <div className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-orange-700">Sign Agreement</h3>
                <p className="text-sm text-orange-600">Sign to lock in your booking</p>
              </div>
            </div>
            <Button 
              onClick={() => setAgreementModalOpen(true)} 
              className="bg-orange-500 hover:bg-orange-600"
            >
              <FileText className="mr-2 h-4 w-4" />
              View & Sign Agreement
            </Button>
          </div>
        </div>
      );
    }
    
    if (currentStep.step === 4) {
      return (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-700">Awaiting Scheduling</h3>
                <p className="text-sm text-blue-600">We will be in touch within 24 hours</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Our scheduling team will contact you within 24 hours to arrange your installation date. 
              We'll work with your preferred times to find the best slot.
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-semibold mb-2">{currentStep.title}</h3>
        <p className="text-muted-foreground">{currentStep.description}</p>
      </div>
    );
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

  const currentStep = getCurrentStep();
  const progressSteps = getProgressSteps();

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/client/orders')}
            className="text-red-500 border-red-500 hover:bg-red-50"
          >
            ← Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Order {order.order_number}</h1>
            <p className="text-muted-foreground">
              Accepted on {format(new Date(order.created_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={fetchOrder}>Refresh</Button>
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            {order.status_enhanced?.replace(/_/g, ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Progress Steps */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
              <CardDescription>
                {progressSteps.filter(s => s.completed).length} of {progressSteps.length} steps completed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {progressSteps.map((step) => {
                const IconComponent = step.icon;
                return (
                  <div key={step.number} className={`flex items-center gap-4 p-3 rounded-lg ${
                    step.active ? 'bg-red-50 border border-red-200' : 
                    step.completed ? 'bg-green-50 border border-green-200' : 
                    'bg-gray-50'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.completed ? 'bg-green-500 text-white' :
                      step.active ? 'bg-red-500 text-white' :
                      'bg-gray-300 text-gray-600'
                    }`}>
                      {step.completed ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${
                        step.active ? 'text-red-700' : 
                        step.completed ? 'text-green-700' : 
                        'text-gray-600'
                      }`}>
                        {step.title}
                      </p>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Current Step Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Step Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-red-600">
                  Step {currentStep.step} of {progressSteps.length} - {currentStep.title}
                </CardTitle>
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  Active
                </Badge>
              </div>
              <CardDescription>{currentStep.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {renderStepContent()}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-bold">£{order.total_amount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-lg font-bold text-green-600">£{order.amount_paid}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-lg font-bold text-orange-600">£{order.total_amount - order.amount_paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          {order.client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
                  {order.job_address && (
                    <div className="flex items-start gap-2 mt-4">
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
            <CardContent>
              {order.scheduled_install_date ? (
                <div>
                  <p className="font-medium">Scheduled Date</p>
                  <p className="text-muted-foreground">
                    {format(new Date(order.scheduled_install_date), 'PPP')}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600">
                  <Clock className="h-4 w-4" />
                  <p>Installation date will be scheduled after survey and payment completion</p>
                </div>
              )}
              
              {order.engineer && (
                <div className="mt-4">
                  <p className="font-medium">Assigned Engineer</p>
                  <p className="text-muted-foreground">{order.engineer.name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Notes */}
          <OrderNotesSection 
            orderId={order.id} 
            onUpdate={fetchOrder}
          />

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

      {/* Agreement Signing Modal */}
      <AgreementSigningModal
        isOpen={agreementModalOpen}
        onClose={() => setAgreementModalOpen(false)}
        order={order}
        onAgreementSigned={handleAgreementSigned}
      />
    </div>
  );
}