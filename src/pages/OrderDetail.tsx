import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { BrandPage, BrandContainer, BrandHeading1, BrandLoading } from '@/components/brand';
import { OrderStickyHeader } from '@/components/admin/OrderStickyHeader';
import { OrderActionBar } from '@/components/admin/OrderActionBar';
import { OfferLinkWidget } from '@/components/admin/OfferLinkWidget';
import { OrderSectionLayout } from '@/components/admin/OrderSectionLayout';
import { AdminOrderOverview } from '@/components/admin/AdminOrderOverview';
import { ClientDetailsSection } from '@/components/admin/sections/ClientDetailsSection';
import { ProductSummarySection } from '@/components/admin/sections/ProductSummarySection';
import { InstallationManagementSection } from '@/components/admin/sections/InstallationManagementSection';
import { PaymentSection } from '@/components/admin/sections/PaymentSection';
import { AgreementSection } from '@/components/admin/sections/AgreementSection';
import { JobStatusTimelineSection } from '@/components/admin/sections/JobStatusTimelineSection';
import { ActivityHistorySection } from '@/components/admin/sections/ActivityHistorySection';
import { EngineerUploadsSection } from '@/components/admin/sections/EngineerUploadsSection';
import { SurveySection } from '@/components/admin/sections/SurveySection';
import { SurveyReviewSection } from '@/components/admin/sections/SurveyReviewSection';
import { ClientBlockedDatesSection } from '@/components/admin/sections/ClientBlockedDatesSection';
import { OrderQuotesSection } from '@/components/admin/sections/OrderQuotesSection';
import { OrderStatusEnhanced } from '@/components/admin/EnhancedJobStatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  status: string;
  status_enhanced: OrderStatusEnhanced;
  manual_status_override: boolean;
  manual_status_notes: string | null;
  total_amount: number;
  deposit_amount: number;
  amount_paid: number;
  job_address: string | null;
  installation_date: string | null;
  installation_notes: string | null;
  agreement_signed_at: string | null;
  agreement_document_url: string | null;
  created_at: string;
  engineer_id: string | null;
  scheduled_install_date: string | null;
  time_window: string | null;
  estimated_duration_hours: number | null;
  internal_install_notes: string | null;
  admin_qa_notes: string | null;
  quote_id: string | null;
  client_id: string;
  client: {
    id: string;
    full_name: string;
    email: string;
    address: string | null;
    postcode: string | null;
    phone?: string;
  };
  quote: {
    id: string;
    quote_number: string;
    total_cost: number;
    product_details: string;
    warranty_period: string;
    special_instructions: string | null;
    quote_items: Array<{
      id: string;
      product_id: string | null;
      product_name: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      configuration: Record<string, string>;
    }>;
  };
  order_payments: Array<{
    id: string;
    amount: number;
    payment_type: string;
    status: string;
    paid_at: string | null;
    created_at: string;
  }>;
  engineer?: {
    id: string;
    name: string;
    email: string;
  };
  engineer_uploads?: Array<{
    id: string;
    file_name: string;
    file_url: string;
    upload_type: string;
    description: string | null;
    uploaded_at: string;
  }>;
  partner?: {
    name: string;
    client_payment_required?: boolean;
    client_agreement_required?: boolean;
    client_survey_required?: boolean;
  } | null;
  is_partner_job: boolean;
  scheduling_suppressed: boolean;
  survey?: {
    id: string;
    status: string;
    responses: any;
    submitted_at: string;
    review_notes?: string;
    reviewed_at?: string;
  };
}

interface PaymentConfig {
  payment_stage: 'deposit' | 'full' | 'staged';
  deposit_type: 'percentage' | 'fixed';
  deposit_amount: number;
  currency: string;
}

export default function OrderDetail() {
  const { id: orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role: userRole, loading: roleLoading } = useUserRole();
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferredDates, setPreferredDates] = useState({
    date1: '',
    date2: '',
    date3: '',
    notes: ''
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [showSigningModal, setShowSigningModal] = useState(false);
  // Admin sticky header state
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
      fetchPaymentConfig();
    }
  }, [orderId]);

  // Track scroll position for sticky header (admin only)
  useEffect(() => {
    if (userRole === 'admin') {
      const handleScroll = () => {
        setIsSticky(window.scrollY > 100);
      };
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [userRole]);

  const fetchOrder = async () => {
    if (!orderId) {
      console.error('[OrderDetail] No orderId provided');
      toast({
        title: "Error",
        description: "Invalid order ID",
        variant: "destructive",
      });
      navigate('/admin/orders');
      return;
    }

    console.log('[OrderDetail] Fetching order with ID:', orderId);
    console.log('[OrderDetail] User role:', userRole);
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(
            id, 
            full_name, 
            email, 
            address, 
            postcode, 
            phone
          ),
          quote:quotes(
            id,
            quote_number,
            total_cost,
            product_details,
            warranty_period,
            special_instructions,
            quote_items(
              id,
              product_id,
              product_name,
              quantity,
              unit_price,
              total_price,
              configuration
            )
          ),
          order_payments(
            id,
            amount,
            payment_type,
            status,
            paid_at,
            created_at
          ),
          engineer:engineers(
            id,
            name,
            email
          ),
          engineer_uploads(
            id,
            file_name,
            file_url,
            upload_type,
            description,
            uploaded_at
          ),
          partner:partners(
            name, 
            client_payment_required, 
            client_agreement_required, 
            client_survey_required
          ),
          client_surveys(
            id,
            status,
            responses,
            submitted_at,
            review_notes,
            reviewed_at
          )
        `)
        .eq('id', orderId)
        .maybeSingle();

      console.log('[OrderDetail] Raw query result:', { data, error });

      if (error) {
        console.error('[OrderDetail] Database error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      if (!data) {
        console.error('[OrderDetail] Order not found for ID:', orderId);
        toast({
          title: "Error",
          description: "Order not found",
          variant: "destructive",
        });
        navigate('/admin/orders');
        return;
      }
      
      console.log('[OrderDetail] Order data structure:', {
        id: data.id,
        order_number: data.order_number,
        hasClient: !!data.client,
        hasQuote: !!data.quote,
        hasEngineer: !!data.engineer,
        hasPartner: !!data.partner,
        surveysCount: data.client_surveys?.length || 0,
        paymentsCount: data.order_payments?.length || 0,
        uploadsCount: data.engineer_uploads?.length || 0
      });
      
      // Detailed logging for each relation
      if (data.client) {
        console.log('[OrderDetail] Client data:', data.client);
      } else {
        console.warn('[OrderDetail] No client data found');
      }
      
      if (data.quote) {
        console.log('[OrderDetail] Quote data:', {
          id: data.quote.id,
          quote_number: data.quote.quote_number,
          itemsCount: data.quote.quote_items?.length || 0
        });
      } else {
        console.warn('[OrderDetail] No quote data found');
      }
      
      if (data.engineer) {
        console.log('[OrderDetail] Engineer data:', data.engineer);
      } else {
        console.log('[OrderDetail] No engineer assigned');
      }
      
      if (data.partner) {
        console.log('[OrderDetail] Partner data:', data.partner);
      } else {
        console.log('[OrderDetail] No partner data');
      }
      
      // Transform the data to match our interface
      const transformedOrder = {
        ...data,
        survey: data.client_surveys?.[0] || null // Get first survey if exists
      };
      
      console.log('[OrderDetail] Transformed order ready to set:', transformedOrder);
      setOrder(transformedOrder as any);
      
    } catch (error: any) {
      console.error('[OrderDetail] Error fetching order:', {
        message: error?.message || 'Unknown error',
        stack: error?.stack,
        orderId
      });
      toast({
        title: "Something went wrong",
        description: "We couldn't complete that action. Nothing has been lost.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_config')
        .single();

      if (error) throw error;
      setPaymentConfig(data.setting_value as unknown as PaymentConfig);
    } catch (error) {
      console.error('Error fetching payment config:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'awaiting_payment': return 'bg-yellow-500';
      case 'deposit_paid': return 'bg-blue-500';
      case 'paid': return 'bg-green-500';
      case 'install_scheduled': return 'bg-purple-500';
      case 'completed': return 'bg-green-600';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'awaiting_payment': return 'Awaiting Payment';
      case 'deposit_paid': return 'Deposit Paid';
      case 'paid': return 'Paid in Full';
      case 'install_scheduled': return 'Installation Scheduled';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const calculateOutstanding = () => {
    if (!order || !paymentConfig) return 0;
    
    let outstanding = 0;
    if (paymentConfig.payment_stage === 'deposit') {
      outstanding = order.deposit_amount - order.amount_paid;
    } else {
      outstanding = order.total_amount - order.amount_paid;
    }
    
    // If this is a new order with no deposit amount set, use total amount
    if (outstanding === 0 && order.amount_paid === 0 && order.total_amount > 0) {
      outstanding = paymentConfig.payment_stage === 'deposit' 
        ? Math.max(order.deposit_amount, order.total_amount * 0.25) // Default 25% deposit
        : order.total_amount;
    }
    
    // Ensure we don't show negative outstanding amounts
    return Math.max(0, outstanding);
  };

  const shouldShowDepositButton = () => {
    if (!order || !paymentConfig) return false;
    return paymentConfig.payment_stage === 'deposit' && order.amount_paid < order.deposit_amount;
  };

  const shouldShowBalanceButton = () => {
    if (!order || !paymentConfig) return false;
    return (paymentConfig.payment_stage === 'staged' || order.amount_paid >= order.deposit_amount) 
           && order.amount_paid < order.total_amount;
  };

  // For client view, we'll redirect to the enhanced client order view
  const redirectToClientView = () => {
    navigate(`/client/orders/${orderId}`);
  };


  const handlePayment = async (type: 'deposit' | 'balance') => {
    if (!order || !orderId) return;
    
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

      // Create payment session
      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body: {
          order_id: orderId,
          amount: paymentAmount,
          payment_type: type
        }
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe checkout in a new tab
        window.open(data.url, '_blank');
      } else {
        throw new Error('No payment URL received');
      }

    } catch (error) {
      console.error('Error creating payment session:', error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  // Check for payment success/cancellation on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
      // Verify payment with backend
      verifyPayment(sessionId);
    } else if (paymentStatus === 'cancelled') {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled",
        variant: "destructive",
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const verifyPayment = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { session_id: sessionId }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Payment Successful",
          description: `Payment of ${formatCurrency(data.amount_paid)} was processed successfully`,
        });
        
        // Refresh order data
        fetchOrder();
        
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }

    } catch (error) {
      console.error('Error verifying payment:', error);
      toast({
        title: "Payment Verification Error",
        description: "Payment may have succeeded but verification failed. Contact support if needed.",
        variant: "destructive",
      });
    }
  };

  const openSigningDocument = async () => {
    if (!order || !orderId) return;
    
    console.log('Opening signing document for order:', order);
    console.log('Quote data:', order.quote);
    
    try {
      // Generate the agreement document HTML
      if (!order.quote?.id) {
        throw new Error('Quote ID not found');
      }
      
      const response = await supabase.functions.invoke('generate-quote-pdf', {
        body: {
          quoteId: order.quote.id,
          type: 'agreement'
        }
      });

      console.log('PDF generation response:', response);

      if (response.error) throw response.error;

      // The response now contains the HTML directly
      if (response.data) {
        // Create a blob with the HTML content
        const htmlBlob = new Blob([response.data], { type: 'text/html' });
        const htmlUrl = URL.createObjectURL(htmlBlob);
        
        console.log('Opening agreement URL:', htmlUrl);
        
        // Open the agreement in a new tab for signing
        const opened = window.open(htmlUrl, '_blank');
        console.log('Window.open result:', opened);
        
        if (!opened) {
          // Fallback if popup was blocked
          alert('Popup blocked! Please allow popups for this site and try again.');
        }
        
        // Mark agreement as signed (in a real implementation, this would be done after actual signing)
        setTimeout(async () => {
          await markAgreementSigned();
        }, 3000); // Simulate signing delay
      } else {
        console.log('No data received from server');
        alert('No content received from server');
      }
    } catch (error) {
      console.error('Error opening agreement:', error);
      toast({
        title: "Error",
        description: "Failed to open agreement document",
        variant: "destructive",
      });
    }
  };

  const downloadAgreementPDF = async () => {
    if (!order) return;
    
    try {
      if (!order.quote?.id) {
        throw new Error('Quote ID not found');
      }
      
      const { data, error } = await supabase.functions.invoke('generate-quote-pdf', {
        body: {
          quoteId: order.quote.id,  // Fixed: changed from quote_id to quoteId
          type: 'agreement'
        }
      });

      if (error) throw error;

      if (data?.url) {
        // Create a temporary link to download the PDF
        const link = document.createElement('a');
        link.href = data.url;
        link.download = `Agreement-${order.order_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading agreement:', error);
      toast({
        title: "Error",
        description: "Failed to download agreement",
        variant: "destructive",
      });
    }
  };

  const markAgreementSigned = async () => {
    if (!orderId) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          agreement_signed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Agreement Signed",
        description: "Service agreement has been signed successfully",
      });

      fetchOrder(); // Refresh order data
    } catch (error) {
      console.error('Error marking agreement as signed:', error);
      toast({
        title: "Error",
        description: "Failed to update agreement status",
        variant: "destructive",
      });
    }
  };

  const submitPreferredDates = async () => {
    if (!preferredDates.date1) {
      toast({
        title: "Error",
        description: "Please provide at least one preferred date",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          installation_notes: `Preferred dates: ${preferredDates.date1}${preferredDates.date2 ? `, ${preferredDates.date2}` : ''}${preferredDates.date3 ? `, ${preferredDates.date3}` : ''}\nNotes: ${preferredDates.notes}`
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Preferred installation dates submitted",
      });

      fetchOrder();
    } catch (error) {
      console.error('Error submitting dates:', error);
      toast({
        title: "Error",
        description: "Failed to submit preferred dates",
        variant: "destructive",
      });
    }
  };


  if (loading || roleLoading) {
    return <BrandLoading />;
  }

  // Redirect to auth if not authenticated
  if (!userRole) {
    // Store the current path for redirect after login
    sessionStorage.setItem('authRedirectPath', window.location.pathname);
    navigate('/auth');
    return <BrandLoading />;
  }

  if (!order) {
    return (
      <BrandPage>
        <BrandContainer>
          <div className="text-center py-12">
            <h1 className="text-2xl font-semibold">Order not found</h1>
            <Button onClick={() => navigate('/client')} className="mt-4">
              Back to Dashboard
            </Button>
          </div>
        </BrandContainer>
      </BrandPage>
    );
  }


  // Admin View - New Section-Based Layout
  if (userRole === 'admin') {
    return (
      <BrandPage>
        {/* Sticky Header */}
        <OrderStickyHeader order={order} isSticky={isSticky} />
        
        <BrandContainer>
          <div className="space-y-6">
            {/* Page Header with Action Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="outline" onClick={() => navigate('/admin/orders')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Orders
                </Button>
                <div>
                  <div className="flex items-center gap-3">
                    <BrandHeading1>Order {order?.order_number || 'Unknown'}</BrandHeading1>
                    {order?.is_partner_job && order?.partner?.name && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                        Partner: {order.partner.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    Created on {order?.created_at ? new Date(order.created_at).toLocaleDateString() : 'Unknown date'}
                  </p>
                </div>
              </div>
              
              {/* Action Bar */}
              <OrderActionBar orderId={orderId!} order={order} />
            </div>

          <div className="space-y-6">
            {/* Order Overview */}
            {order && (
              <AdminOrderOverview order={order} />
            )}

            {/* Client Information */}
            {order && (
              <ClientDetailsSection 
                order={order} 
                onUpdate={fetchOrder}
              />
            )}

            {/* Product Summary */}
            {order?.quote && (
              <ProductSummarySection 
                order={order} 
                onUpdate={fetchOrder}
              />
            )}

            {/* Quote History & Management */}
            {order && (
              <OrderQuotesSection 
                order={order} 
                onOrderUpdate={fetchOrder}
              />
            )}

            {/* Payment Management */}
            {order && (
              <PaymentSection order={order} />
            )}

            {/* Service Agreement */}
            {order && (
              <AgreementSection order={order} />
            )}

            {/* Installation Management */}
            {order && (
              <InstallationManagementSection 
                order={order} 
                onUpdate={fetchOrder}
                paymentRequired={order.partner?.client_payment_required ?? true}
                agreementRequired={order.partner?.client_agreement_required ?? true}
              />
            )}

            {/* Offer Link Widget */}
            {orderId && (
              <OfferLinkWidget orderId={orderId} />
            )}

            {/* Job Status & Timeline */}
            {order && (
              <JobStatusTimelineSection 
                order={order} 
                onUpdate={fetchOrder}
              />
            )}

            {/* Activity & History */}
            {orderId && (
              <ActivityHistorySection orderId={orderId} />
            )}

            {/* Client Blocked Dates */}
            {order?.client?.id && (
              <ClientBlockedDatesSection 
                clientId={order.client.id}
                onDataChange={fetchOrder}
              />
            )}

            
            {/* Survey Section */}
            {orderId && (
              <SurveySection orderId={orderId} />
            )}
            
            {/* Survey Review Section - for orders with submitted surveys */}
            {order?.status_enhanced === 'awaiting_survey_review' && order?.client?.id && order?.quote_id && (
              <SurveyReviewSection
                order={{
                  id: order.id,
                  client_id: order.client.id,
                  quote_id: order.quote_id,
                  status_enhanced: order.status_enhanced
                }}
                survey={order.survey}
                onUpdate={fetchOrder}
              />
            )}

            {/* Engineer Uploads & Completion */}
            {order && (
              <EngineerUploadsSection 
                order={order} 
                onUpdate={fetchOrder}
              />
            )}
          </div>
          </div>
        </BrandContainer>
      </BrandPage>
    );
  }

  // For client users, redirect to the enhanced client order view
  if (userRole === 'client') {
    redirectToClientView();
    return <BrandLoading />;
  }

  // Default fallback for unknown roles
  return (
    <BrandPage>
      <BrandContainer>
        <div className="text-center py-12">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground mt-2">You don't have permission to view this page.</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go Home
          </Button>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}