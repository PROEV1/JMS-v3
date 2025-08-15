import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrderStatusSync } from "@/hooks/useOrderStatusSync";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { EnhancedJobStatusBadge, OrderStatusEnhanced } from "@/components/admin/EnhancedJobStatusBadge";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Download, 
  CheckCircle, 
  Clock, 
  Calendar,
  Star,
  FileText,
  CreditCard,
  User,
  MapPin
} from "lucide-react";
import { AgreementSigningModal } from "@/components/AgreementSigningModal";


interface ClientOrder {
  id: string;
  order_number: string;
  status_enhanced: OrderStatusEnhanced;
  total_amount: number;
  amount_paid: number;
  deposit_amount?: number;
  agreement_signed_at: string | null;
  scheduled_install_date: string | null;
  created_at: string;
  status: string;
  client: {
    full_name: string;
    email: string;
    address: string | null;
  };
  quote: {
    quote_number: string;
    warranty_period: string;
    quote_items: Array<{
      product_name: string;
      quantity: number;
      total_price: number;
    }>;
  };
  engineer?: {
    name: string;
    email: string;
  } | null;
}

export default function EnhancedClientOrderView() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<ClientOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const { lastStatus } = useOrderStatusSync(orderId!);

  useEffect(() => {
    if (orderId) {
      checkPendingPayments();
    }
  }, [orderId]);

  // Also refresh every 10 seconds to ensure data is current
  useEffect(() => {
    if (orderId) {
      const interval = setInterval(() => {
        console.log('Auto-refreshing order data...');
        fetchOrder();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [orderId]);

  useEffect(() => {
    if (lastStatus && order) {
      // Refresh order data when status changes
      fetchOrder();
    }
  }, [lastStatus]);

  // Recalculate active step whenever order changes
  useEffect(() => {
    if (order) {
      const steps = getProgressSteps();
      const newActiveStep = steps.findIndex(step => step.isActive);
      if (newActiveStep >= 0 && newActiveStep !== activeStep) {
        console.log('Updating active step from', activeStep, 'to', newActiveStep);
        setActiveStep(newActiveStep);
      }
    }
  }, [order?.amount_paid, order?.agreement_signed_at, order?.scheduled_install_date, order?.status]);

  const checkPendingPayments = async () => {
    console.log('Checking pending payments and fetching order...');
    
    // Always fetch order data first to get latest state
    await fetchOrder();
    
    try {
      // Get URL parameters to check if returning from Stripe
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      
      if (sessionId) {
        console.log('Found session_id, verifying payment:', sessionId);
        
        // Verify the payment
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { session_id: sessionId }
        });

        console.log('Payment verification response:', { data, error });

        if (error) {
          console.error('Payment verification error:', error);
          toast({
            title: "Payment Verification Error",
            description: error.message || "Failed to verify payment",
            variant: "destructive",
          });
        } else if (data?.success) {
          toast({
            title: "Payment Confirmed",
            description: `Payment of ${data.amount_paid ? `£${data.amount_paid}` : ''} was processed successfully!`,
          });
          
          // Force immediate refresh and wait for completion
          console.log('Payment verified successfully, refreshing order data...');
          setLoading(true);
          
          // Refresh order data immediately
          await fetchOrder();
          
          // Wait a bit more and refresh again to ensure we get the latest data
          setTimeout(async () => {
            console.log('Second refresh after payment verification...');
            await fetchOrder();
            setLoading(false);
          }, 1000);
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error('Error checking pending payments:', error);
      toast({
        title: "Error",
        description: "Failed to verify payment status",
        variant: "destructive",
      });
    }
  };

  const fetchOrder = async () => {
    try {
      console.log('Fetching order data for ID:', orderId);
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(full_name, email, address),
          quote:quotes(
            quote_number,
            warranty_period,
            quote_items(product_name, quantity, total_price)
          ),
          engineer:engineers(name, email)
        `)
        .eq('id', orderId)
        .maybeSingle();

      console.log('Order fetch result:', { data, error });

      if (error) {
        console.error('Error fetching order:', error);
        throw error;
      }
      
      if (data) {
        console.log('Order data received:', {
          id: data.id,
          amount_paid: data.amount_paid,
          total_amount: data.total_amount,
          status: data.status
        });
        
        setOrder(data as any);
        
        // Update active step based on new order data
        const steps = getProgressSteps();
        const newActiveStep = steps.findIndex(step => step.isActive);
        if (newActiveStep >= 0) {
          console.log('Setting active step to:', newActiveStep);
          setActiveStep(newActiveStep);
        }
      } else {
        console.error('No order found for ID:', orderId);
        toast({
          title: "Order Not Found",
          description: "The requested order could not be found.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: "Error",
        description: "Failed to load order details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getProgressSteps = () => {
    if (!order) return [];

    const depositComplete = order.amount_paid >= (order.deposit_amount || order.total_amount * 0.25);
    const paymentComplete = order.amount_paid >= order.total_amount;
    const agreementSigned = !!order.agreement_signed_at;
    const installScheduled = !!order.scheduled_install_date;
    const installComplete = order.status === 'completed';

    return [
      {
        id: 'payment',
        title: 'Make Payment',
        subtitle: 'Make payment to move forward',
        completed: depositComplete,
        icon: CreditCard,
        details: depositComplete ? 'Deposit received' : `Deposit ${formatCurrency((order.deposit_amount || order.total_amount * 0.25))} required`,
        isActive: !depositComplete
      },
      {
        id: 'agreement',
        title: 'Sign Agreement',
        subtitle: 'Sign to lock in your booking',
        completed: agreementSigned,
        icon: FileText,
        details: agreementSigned 
          ? `Signed on ${format(new Date(order.agreement_signed_at!), 'PPP')}` 
          : 'Pending signature',
        isActive: depositComplete && !agreementSigned
      },
      {
        id: 'scheduling',
        title: 'Submit Install Preferences',
        subtitle: 'Choose your preferred install date',
        completed: installScheduled,
        icon: Calendar,
        details: installScheduled 
          ? `Scheduled for ${format(new Date(order.scheduled_install_date!), 'PPP')}${order.engineer ? ` with ${order.engineer.name}` : ''}`
          : 'Awaiting scheduling',
        isActive: depositComplete && agreementSigned && !installScheduled
      },
      {
        id: 'completion',
        title: 'Install Confirmed',
        subtitle: 'We\'ll confirm install shortly',
        completed: installComplete,
        icon: CheckCircle,
        details: installComplete ? 'Installation complete' : 'Pending completion',
        isActive: installScheduled && !installComplete
      }
    ];
  };

  const getCurrentActiveStep = () => {
    const steps = getProgressSteps();
    const activeStepIndex = steps.findIndex(step => step.isActive);
    return activeStepIndex >= 0 ? activeStepIndex : steps.length - 1;
  };

  const handlePayment = async (paymentType: 'deposit' | 'balance') => {
    if (!order) return;
    
    setPaymentLoading(true);
    try {
      const depositAmount = order.deposit_amount || order.total_amount * 0.25;
      const balanceAmount = order.total_amount - order.amount_paid;
      const amount = paymentType === 'deposit' ? Math.min(depositAmount, balanceAmount) : balanceAmount;

      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body: {
          order_id: order.id,
          amount: amount,
          payment_type: paymentType
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to create payment session');
      }

      if (!data?.url) {
        throw new Error('No payment URL received');
      }

      // Redirect to Stripe checkout in the same window
      window.location.href = data.url;

      toast({
        title: "Payment Session Created",
        description: "Redirecting to Stripe checkout in a new tab...",
      });

    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
          <p className="text-muted-foreground">The requested order could not be found.</p>
        </Card>
      </div>
    );
  }

  const progressSteps = getProgressSteps();
  const completedSteps = progressSteps.filter(step => step.completed).length;
  const progressPercentage = (completedSteps / progressSteps.length) * 100;
  const currentStep = getCurrentActiveStep();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/client')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Order {order.order_number}</h1>
            <p className="text-muted-foreground">
              Accepted on {format(new Date(order.created_at), 'PP')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchOrder()}>
            Refresh
          </Button>
          <EnhancedJobStatusBadge status={order.status_enhanced} />
        </div>
      </div>

      {/* Status Alert */}
      {lastStatus && (
        <Card className="border-green-200 bg-green-50">
          <div className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">Status Updated!</span>
            </div>
            <p className="text-green-700 mt-1">
              Your order status has been updated. Check the progress below for details.
            </p>
          </div>
        </Card>
      )}

      {/* Installation Confirmed Banner */}
      {order.scheduled_install_date && (
        <Card className="border-blue-200 bg-blue-50">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">✅ Your installation is now confirmed!</h3>
                <p className="text-blue-700">
                  {format(new Date(order.scheduled_install_date), 'EEEE, MMMM d, yyyy')}
                  {order.engineer && ` with ${order.engineer.name}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Installation Confirmed
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Completion Message */}
      {order.status === 'completed' && (
        <Card className="border-green-200 bg-green-50">
          <div className="p-6 text-center">
            <div className="p-3 bg-green-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-900 mb-2">
              Thank you! Your installation is now complete.
            </h3>
            <p className="text-green-700 mb-4">
              Your warranty is active, and we're here if you need anything.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" className="border-green-300">
                <Download className="h-4 w-4 mr-2" />
                Download Warranty Certificate
              </Button>
              <Button variant="outline" className="border-green-300">
                <Star className="h-4 w-4 mr-2" />
                Leave a Review
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main Layout with Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Progress Steps */}
        <div className="lg:col-span-1">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Your Progress</h3>
            
            <div className="space-y-4">
              {progressSteps.map((step, index) => {
                const IconComponent = step.icon;
                const isCurrentStep = index === currentStep;
                
                return (
                  <div 
                    key={step.id} 
                    className={`
                      flex items-start gap-3 p-3 rounded-lg transition-colors
                      ${isCurrentStep ? 'bg-blue-50 border border-blue-200' : ''}
                      ${step.completed ? 'opacity-100' : 'opacity-70'}
                      ${(step.completed || step.isActive) ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-50'}
                    `}
                    onClick={() => {
                      // Only allow clicking on completed steps or the current active step
                      if (step.completed || step.isActive) {
                        setActiveStep(index);
                      }
                    }}
                  >
                    <div className={`
                      p-2 rounded-full transition-colors flex-shrink-0
                      ${step.completed 
                        ? 'bg-green-100 text-green-600' 
                        : isCurrentStep
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-400'
                      }
                    `}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${step.completed || isCurrentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.title}
                        </span>
                        {step.completed && (
                          <Badge variant="secondary" className="h-4 text-xs bg-green-100 text-green-700">
                            ✓
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {step.subtitle}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Main Content Area - Active Step */}
        <div className="lg:col-span-3">
          {activeStep === 0 && (
            <Card className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-blue-600">
                    Step 1 of 4 - Make Payment
                  </h2>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    Active
                  </Badge>
                </div>
                <p className="text-muted-foreground">Make payment to move forward</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Order Value:</span>
                  <span className="font-semibold">{formatCurrency(order.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deposit Required:</span>
                  <span className="font-semibold">{formatCurrency((order.deposit_amount || order.total_amount * 0.25))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(order.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Outstanding:</span>
                  <span className="text-red-600">{formatCurrency(order.total_amount - order.amount_paid)}</span>
                </div>

                {order.amount_paid < order.total_amount && (
                  (() => {
                    const depositAmount = order.deposit_amount || order.total_amount * 0.25;
                    const depositComplete = order.amount_paid >= depositAmount;
                    const balanceAmount = order.total_amount - order.amount_paid;
                    
                    return (
                      <Button 
                        className="w-full mt-6" 
                        onClick={() => handlePayment(depositComplete ? 'balance' : 'deposit')}
                        disabled={paymentLoading}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        {paymentLoading 
                          ? 'Processing...' 
                          : depositComplete 
                            ? `Pay Balance (${formatCurrency(balanceAmount)})`
                            : `Pay Deposit Now (${formatCurrency(Math.min(depositAmount, balanceAmount))})`
                        }
                      </Button>
                    );
                  })()
                )}
              </div>
            </Card>
          )}

          {activeStep === 1 && (
            <Card className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-blue-600">
                  Step 2 of 4 - Sign Agreement
                </h2>
                <p className="text-muted-foreground">Sign to lock in your booking</p>
              </div>

              {order.agreement_signed_at ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-800 mb-2">Agreement Signed!</h3>
                  <p className="text-muted-foreground">
                    Signed on {format(new Date(order.agreement_signed_at), 'PPP')}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Ready to Sign Agreement</h3>
                  <p className="text-muted-foreground mb-6">
                    Review and sign your service agreement to proceed
                  </p>
                  <Button onClick={() => setAgreementModalOpen(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    View & Sign Agreement
                  </Button>
                </div>
              )}
            </Card>
          )}

          {activeStep === 2 && (
            <Card className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-blue-600">
                  Step 3 of 4 - Submit Install Preferences
                </h2>
                <p className="text-muted-foreground">Awaiting scheduling confirmation</p>
              </div>

              {order.scheduled_install_date ? (
                <div className="text-center py-8">
                  <Calendar className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-800 mb-2">Installation Scheduled!</h3>
                  <p className="text-muted-foreground">
                    {format(new Date(order.scheduled_install_date), 'EEEE, MMMM d, yyyy')}
                    {order.engineer && ` with ${order.engineer.name}`}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Awaiting Scheduling by Pro Spaces Team</h3>
                  <p className="text-muted-foreground mb-6">
                    Our team will contact you shortly to schedule your installation
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>What happens next:</strong><br />
                      • Our team will review your order<br />
                      • We'll contact you to arrange a suitable installation date<br />
                      • You'll receive confirmation once scheduled
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )}

          {activeStep === 3 && (
            <Card className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-blue-600">
                  Step 4 of 4 - Install Confirmed
                </h2>
                <p className="text-muted-foreground">We'll confirm install shortly</p>
              </div>

              {order.status === 'completed' ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-800 mb-2">Installation Complete!</h3>
                  <p className="text-muted-foreground mb-6">
                    Your installation has been completed successfully
                  </p>
                  <div className="flex justify-center gap-4">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download Warranty
                    </Button>
                    <Button variant="outline">
                      <Star className="h-4 w-4 mr-2" />
                      Leave Review
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Pending Completion</h3>
                  <p className="text-muted-foreground">
                    We'll update you once the installation is complete
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Order Summary Card */}
          <Card className="p-6 mt-6">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            
            <div className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">Products Ordered:</span>
                {order.quote.quote_items.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.product_name} (Qty: {item.quantity})</span>
                    <span>{formatCurrency(item.total_price)}</span>
                  </div>
                ))}
              </div>
              
              <Separator />
              
              <div className="flex justify-between font-semibold text-lg">
                <span>Total Value:</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </Card>

          {/* Support Card */}
          <Card className="p-6 mt-6">
            <h3 className="font-semibold mb-4">Need Help?</h3>
            <p className="text-muted-foreground mb-4">
              Our support team is here to help with any questions about your order.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="w-full">
                Email Support
              </Button>
              <Button variant="outline" className="w-full">
                Call Support
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Agreement Signing Modal */}
      <AgreementSigningModal
        isOpen={agreementModalOpen}
        onClose={() => setAgreementModalOpen(false)}
        order={order}
        onAgreementSigned={() => {
          setAgreementModalOpen(false);
          fetchOrder(); // Refresh order data after agreement is signed
          toast({
            title: "Agreement Signed",
            description: "Your agreement has been signed successfully!",
          });
        }}
      />
    </div>
  );
}