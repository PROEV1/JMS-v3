import { useState, useEffect } from 'react';
import MessagesSection from '@/components/MessagesSection';
import { QuoteDetailView } from '@/components/QuoteDetailView';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Calendar, 
  User, 
  DollarSign, 
  Download, 
  CreditCard,
  Phone,
  Mail,
  HelpCircle,
  ShoppingCart,
  Receipt,
  Settings,
  CheckCircle,
  Clock,
  AlertCircle,
  Home,
  MapPin,
  Eye,
  Banknote,
  MessageCircle,
  FolderOpen
} from 'lucide-react';


interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
}

interface Quote {
  id: string;
  quote_number: string;
  product_details: string;
  materials_cost: number;
  install_cost: number;
  extras_cost: number;
  total_cost: number;
  status: string;
  expires_at: string | null;
  created_at: string;
  notes: string | null;
  range?: string;
  finish?: string;
  deposit_required: number;
  customer_reference?: string;
  appointment_date?: string;
  designer_name?: string;
  room_info?: string;
  warranty_period: string;
  includes_installation: boolean;
  special_instructions: string;
  is_shareable: boolean;
  share_token: string;
}

interface Project {
  id: string;
  project_name: string;
  status: string;
  scheduled_date: string | null;
  installer_name?: string;
  notes: string | null;
  created_at: string;
}

interface File {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  upload_type: string;
  document_type?: string;
  created_at: string;
}

interface Payment {
  id: string;
  quote_id: string;
  method: 'cash' | 'finance';
  amount_paid: number;
  paid_on: string;
}

type ViewMode = 'dashboard' | 'quotes' | 'orders' | 'payments' | 'details' | 'help' | 'contact' | 'quote-detail' | 'order-payment';

export default function ClientDashboard() {
  const { user, session, signOut } = useAuth();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteAccepted, setQuoteAccepted] = useState<Record<string, boolean>>({});
  
  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'finance'>('cash');
  const [depositAmount, setDepositAmount] = useState('');
  const [confirmFunding, setConfirmFunding] = useState(false);
  const [confirmTerms, setConfirmTerms] = useState(false);
  const [installASAP, setInstallASAP] = useState(false);

  // Contact form state
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [showQuickMessageModal, setShowQuickMessageModal] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [selectedQuoteForMessage, setSelectedQuoteForMessage] = useState<Quote | null>(null);

  useEffect(() => {
    if (user) {
      console.log('ClientDashboard: Loading client data for user:', user);
      console.log('ClientDashboard: User session:', session);
      loadClientData();
    } else {
      console.log('ClientDashboard: No user, waiting for authentication...');
    }
  }, [user, session]);

  // Handle hash navigation
  useEffect(() => {
    const hash = window.location.hash.substring(1); // Remove the '#'
    if (hash && ['quotes', 'orders', 'contact', 'payments', 'help', 'details'].includes(hash)) {
      // Map hash values to correct view modes
      const hashToViewMap: Record<string, ViewMode> = {
        'quotes': 'quotes',
        'messages': 'contact',
        'documents': 'help',
        'profile': 'details',
        'payments': 'payments',
        'orders': 'orders'
      };
      const targetView = hashToViewMap[hash] || hash as ViewMode;
      setViewMode(targetView);
    }
  }, []);

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash && ['quotes', 'orders', 'contact', 'payments', 'help', 'details', 'messages', 'documents', 'profile'].includes(hash)) {
        const hashToViewMap: Record<string, ViewMode> = {
          'quotes': 'quotes',
          'messages': 'contact',
          'documents': 'help', 
          'profile': 'details',
          'payments': 'payments',
          'orders': 'orders'
        };
        const targetView = hashToViewMap[hash] || hash as ViewMode;
        setViewMode(targetView);
      } else if (!hash) {
        setViewMode('dashboard');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    console.log('ClientDashboard: Quotes updated:', quotes);
    console.log('ClientDashboard: View mode:', viewMode);
  }, [quotes, viewMode]);

  const loadClientData = async () => {
    console.log('Loading client data - Current user:', user);
    console.log('Loading client data - Session:', session);
    
    if (!user) {
      console.log('No user found, skipping data load');
      setLoading(false);
      return;
    }
    try {
      console.log('ClientDashboard: Loading client data for user ID:', user?.id);
      
      const clientRes = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      console.log('ClientDashboard: Client query result:', clientRes);

      if (clientRes.data) {
        setClient(clientRes.data);
        console.log('ClientDashboard: Found client:', clientRes.data);
        
        const [quotesRes, projectsRes, filesRes, paymentsRes, ordersRes] = await Promise.all([
          supabase.from('quotes').select('*').eq('client_id', clientRes.data.id).order('created_at', { ascending: false }),
          supabase.from('projects').select('*').eq('client_id', clientRes.data.id).order('created_at', { ascending: false }),
          supabase.from('files').select('*').eq('client_id', clientRes.data.id).order('created_at', { ascending: false }),
          supabase.from('payments').select('*').order('created_at', { ascending: false }),
          supabase.from('orders').select('*').eq('client_id', clientRes.data.id).order('created_at', { ascending: false }),
        ]);

        console.log('ClientDashboard: Orders query result:', ordersRes);

        if (quotesRes.data) setQuotes(quotesRes.data);
        if (projectsRes.data) setProjects(projectsRes.data);
        if (filesRes.data) setFiles(filesRes.data);
        if (paymentsRes.data) setPayments(paymentsRes.data as Payment[]);
        if (ordersRes.data) {
          console.log('ClientDashboard: Setting orders:', ordersRes.data);
          setOrders(ordersRes.data);
        }
      } else {
        console.log('ClientDashboard: No client found for user:', user?.id);
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuoteAcceptance = (quoteId: string, accepted: boolean) => {
    setQuoteAccepted(prev => ({ ...prev, [quoteId]: accepted }));
  };

  const handleQuoteAction = async (quoteId: string, action: 'accepted' | 'rejected') => {
    try {
      const quote = quotes.find(q => q.id === quoteId);
      if (!quote) {
        throw new Error('Quote not found');
      }

      // Update quote status
      await supabase
        .from('quotes')
        .update({ 
          status: action,
          accepted_at: action === 'accepted' ? new Date().toISOString() : null
        })
        .eq('id', quoteId);

      if (action === 'accepted') {
        // Get payment config to calculate deposit
        const { data: configData } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'payment_config')
          .single();

        const paymentConfig = configData?.setting_value as any;
        let depositAmount = 0;
        
        if (paymentConfig?.deposit_type === 'percentage') {
          depositAmount = Math.round(quote.total_cost * (paymentConfig.deposit_amount / 100));
        } else if (paymentConfig?.deposit_type === 'fixed') {
          depositAmount = paymentConfig.deposit_amount;
        }

        // Generate a simple order number
        const orderNumber = `ORD-${Date.now()}`;
        
        // Create order when quote is accepted
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_number: orderNumber,
            client_id: client?.id,
            quote_id: quoteId,
            total_amount: quote.total_cost,
            deposit_amount: depositAmount,
            status: 'awaiting_payment',
            job_address: client?.address,
            internal_install_notes: quote.room_info // Store understairs width
          })
          .select()
          .single();

        if (orderError) throw orderError;

        toast({
          title: "Success",
          description: "Quote accepted successfully! Your order has been created.",
        });

        // Redirect to order detail page
        window.open(`/order/${order.id}`, '_blank');
      } else if (action === 'rejected') {
        // Check if there's an associated order and delete it
        const { data: orderData } = await supabase
          .from('orders')
          .select('id')
          .eq('quote_id', quoteId)
          .maybeSingle();

        if (orderData) {
          const { error: deleteError } = await supabase
            .from('orders')
            .delete()
            .eq('quote_id', quoteId);

          if (deleteError) throw deleteError;
        }

        toast({
          title: "Success",
          description: "Quote rejected successfully!",
        });
      }

      await loadClientData();
      
      // Update selectedQuote with the new status if it's currently selected
      if (selectedQuote && selectedQuote.id === quoteId) {
        setSelectedQuote({ ...selectedQuote, status: action });
      }
      
      // Update quotes list immediately to refresh the overview
      setQuotes(prevQuotes => 
        prevQuotes.map(quote => 
          quote.id === quoteId 
            ? { ...quote, status: action }
            : quote
        )
      );
    } catch (error) {
      console.error('Error updating quote:', error);
      toast({
        title: "Error",
        description: "Failed to update quote",
        variant: "destructive",
      });
    }
  };

  const proceedWithOrder = (quote: Quote) => {
    setSelectedQuote(quote);
    setDepositAmount((quote.total_cost * 0.25).toFixed(2)); // 25% default deposit
    setViewMode('order-payment');
  };

  const getOrderForQuote = (quoteId: string) => {
    return orders.find(order => order.quote_id === quoteId);
  };

  const submitOrder = async () => {
    if (!selectedQuote || !confirmFunding || !confirmTerms) {
      toast({
        title: "Error",
        description: "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update quote status to accepted
      await supabase
        .from('quotes')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', selectedQuote.id);

      // Create payment record
      await supabase
        .from('payments')
        .insert({
          quote_id: selectedQuote.id,
          method: paymentMethod,
          amount_paid: paymentMethod === 'cash' ? parseFloat(depositAmount) : 0
        });

      // Create project
      await supabase
        .from('projects')
        .insert({
          client_id: client?.id,
          quote_id: selectedQuote.id,
          project_name: `${selectedQuote.range} - ${selectedQuote.room_info}`,
          status: 'quote_accepted',
          notes: installASAP ? 'Install ASAP requested' : null
        });

      toast({
        title: "Success",
        description: "Order confirmed successfully!",
      });

      loadClientData();
      setViewMode('dashboard');
    } catch (error) {
      console.error('Error submitting order:', error);
      toast({
        title: "Error",
        description: "Failed to submit order",
        variant: "destructive",
      });
    }
  };

  const submitContactForm = async () => {
    if (!contactSubject || !contactMessage) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
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
          content: `Subject: ${contactSubject}\n\n${contactMessage}`,
          clientId: client?.id
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

      setContactSubject('');
      setContactMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      sent: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
      accepted: { label: 'Accepted', variant: 'default' as const, icon: CheckCircle },
      rejected: { label: 'Rejected', variant: 'destructive' as const, icon: AlertCircle },
      quote_accepted: { label: 'Awaiting Survey', variant: 'secondary' as const, icon: Calendar },
      scheduled: { label: 'Scheduled', variant: 'default' as const, icon: Calendar },
      fitting: { label: 'Fitting', variant: 'default' as const, icon: Settings },
      complete: { label: 'Complete', variant: 'default' as const, icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status, 
      variant: 'secondary' as const, 
      icon: Clock 
    };
    
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="inline-flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getDocumentsByType = (type: string) => {
    return files.filter(file => file.document_type === type || file.upload_type === type);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-teal"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="brand-heading-1">Client Profile Not Found</CardTitle>
            <CardDescription className="brand-body">Unable to load your client profile. Please contact support.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        {viewMode === 'dashboard' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-primary mb-2 brand-heading-1">
                Welcome, {client?.full_name.split(' ')[0]}!
              </h1>
              <p className="text-muted-foreground brand-body">
                Here's an overview of your orders and account
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Quotes Tile */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-border shadow-md hover:shadow-xl hover:border-brand-teal/40 hover:-translate-y-1 bg-white"
                onClick={() => {
                  setViewMode('quotes');
                  window.history.pushState(null, '', '/client#quotes');
                }}
              >
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-brand-teal/10 border-2 border-brand-teal/20 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <FileText className="h-8 w-8 text-brand-teal" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-primary mb-1 brand-heading-3">Quotes</h3>
                      <p className="text-sm text-muted-foreground mb-3 brand-body">View & accept quotes</p>
                      <div className="inline-flex items-center justify-center bg-brand-teal/10 border border-brand-teal/20 text-brand-teal text-sm font-medium px-3 py-1 rounded-full brand-body shadow-sm">
                        {quotes.length} Active
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Projects Tile */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-border shadow-md hover:shadow-xl hover:border-brand-green/40 hover:-translate-y-1 bg-white"
                onClick={() => {
                  setViewMode('orders');
                  window.history.pushState(null, '', '/client#orders');
                }}
              >
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-brand-green/10 border-2 border-brand-green/20 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <ShoppingCart className="h-8 w-8 text-brand-green" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-primary mb-1 brand-heading-3">Orders</h3>
                      <p className="text-sm text-muted-foreground mb-3 brand-body">Track your orders</p>
                      <div className="inline-flex items-center justify-center bg-brand-green/10 border border-brand-green/20 text-brand-green text-sm font-medium px-3 py-1 rounded-full brand-body shadow-sm">
                        {orders.length} Active
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Messages Tile */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-border shadow-md hover:shadow-xl hover:border-brand-pink/40 hover:-translate-y-1 bg-white relative"
                onClick={() => {
                  setViewMode('contact');
                  window.history.pushState(null, '', '/client#messages');
                }}
              >
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-brand-pink/10 border-2 border-brand-pink/20 rounded-2xl flex items-center justify-center mx-auto relative shadow-sm">
                      <MessageCircle className="h-8 w-8 text-brand-pink" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-destructive border-2 border-white rounded-full flex items-center justify-center shadow-md">
                        <span className="text-xs font-medium text-white">2</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-primary mb-1 brand-heading-3">Messages</h3>
                      <p className="text-sm text-muted-foreground mb-3 brand-body">Chat with team</p>
                      <div className="inline-flex items-center justify-center bg-brand-pink/10 border border-brand-pink/20 text-brand-pink text-sm font-medium px-3 py-1 rounded-full brand-body shadow-sm">
                        2 Unread
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payments Tile */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-border shadow-md hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 bg-white"
                onClick={() => {
                  setViewMode('payments');
                  window.history.pushState(null, '', '/client#payments');
                }}
              >
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-primary/5 border-2 border-primary/10 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <CreditCard className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-primary mb-1 brand-heading-3">Payments</h3>
                      <p className="text-sm text-muted-foreground mb-3 brand-body">Billing & invoices</p>
                      <div className="inline-flex items-center justify-center bg-primary/5 border border-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full brand-body shadow-sm">
                        £{payments.reduce((sum, p) => sum + p.amount_paid, 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Documents Tile */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-border shadow-md hover:shadow-xl hover:border-accent/40 hover:-translate-y-1 bg-white"
                onClick={() => {
                  setViewMode('help');
                  window.history.pushState(null, '', '/client#documents');
                }}
              >
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-accent/5 border-2 border-accent/10 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <FolderOpen className="h-8 w-8 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-primary mb-1 brand-heading-3">Documents</h3>
                      <p className="text-sm text-muted-foreground mb-3 brand-body">Files & contracts</p>
                      <div className="inline-flex items-center justify-center bg-accent/5 border border-accent/10 text-accent-foreground text-sm font-medium px-3 py-1 rounded-full brand-body shadow-sm">
                        {files.length} Files
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Tile */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-border shadow-md hover:shadow-xl hover:border-muted-foreground/30 hover:-translate-y-1 bg-white"
                onClick={() => {
                  setViewMode('details');
                  window.history.pushState(null, '', '/client#profile');
                }}
              >
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-muted/20 border-2 border-muted/40 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-primary mb-1 brand-heading-3">Profile</h3>
                      <p className="text-sm text-muted-foreground mb-3 brand-body">Account settings</p>
                      <div className="inline-flex items-center justify-center bg-muted/20 border border-muted/40 text-muted-foreground text-sm font-medium px-3 py-1 rounded-full brand-body shadow-sm">
                        Settings
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}


        {/* My Quotes Section */}
        {viewMode === 'quotes' && !selectedQuote && (
          <div className="space-y-6">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('dashboard')}
              className="mb-4"
            >
              ← Back to Dashboard
            </Button>
            <h2 className="text-2xl font-bold">My Quotes</h2>
            {quotes.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground">No quotes available</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {quotes.map((quote) => (
                  <Card 
                    key={quote.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedQuote(quote)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl">Quote {quote.quote_number}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            Created: {new Date(quote.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge 
                          variant={quote.status === 'accepted' ? 'default' : 'secondary'}
                          className={
                            quote.status === 'accepted' 
                              ? 'bg-green-500 hover:bg-green-600' 
                              : quote.status === 'rejected'
                              ? 'bg-red-500 hover:bg-red-600'
                              : 'bg-blue-500 hover:bg-blue-600'
                          }
                        >
                          {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground">Product Details</h4>
                          <p className="text-sm">{quote.product_details}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Materials:</span>
                            <span className="ml-2 font-medium">£{quote.materials_cost.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Installation:</span>
                            <span className="ml-2 font-medium">£{quote.install_cost.toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {quote.extras_cost > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Extras:</span>
                            <span className="ml-2 font-medium">£{quote.extras_cost.toLocaleString()}</span>
                          </div>
                        )}
                        
                        <Separator />
                        
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold">Total: £{quote.total_cost.toLocaleString()}</span>
                          <div className="flex space-x-2">
                            {quote.status === 'sent' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuoteAction(quote.id, 'rejected');
                                  }}
                                >
                                  Reject Quote
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuoteAction(quote.id, 'accepted');
                                  }}
                                >
                                  Accept Quote
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {quote.notes && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Notes:</span>
                            <p className="mt-1 text-muted-foreground">{quote.notes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quote Detail View */}
        {viewMode === 'quotes' && selectedQuote && (
          <QuoteDetailView 
            quote={selectedQuote} 
            onBack={() => setSelectedQuote(null)}
            onAccept={(quoteId) => handleQuoteAction(quoteId, 'accepted')}
            onReject={(quoteId) => handleQuoteAction(quoteId, 'rejected')}
            order={getOrderForQuote(selectedQuote.id)}
          />
        )}

        {/* Order Payment Process */}
        {viewMode === 'order-payment' && selectedQuote && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('quotes')}
              className="mb-4"
            >
              ← Back to Quotes
            </Button>
            
            <Card>
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
                <CardDescription>Complete your order for {selectedQuote.customer_reference}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Room Info Summary */}
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Order Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>Range: {selectedQuote.range}</div>
                    <div>Finish: {selectedQuote.finish}</div>
                    <div className="col-span-2 font-bold text-lg">
                      Total Cost: £{selectedQuote.total_cost.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <Label className="text-base font-medium">Payment Method</Label>
                  <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'cash' | 'finance')}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cash" id="cash" />
                      <Label htmlFor="cash">Cash Payment</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="finance" id="finance" />
                      <Label htmlFor="finance">Finance Option</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Deposit Amount */}
                {paymentMethod === 'cash' ? (
                  <div>
                    <Label htmlFor="deposit">Deposit Amount (25% default)</Label>
                    <Input
                      id="deposit"
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Enter deposit amount"
                    />
                  </div>
                ) : (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm">
                      <strong>Finance Option Selected</strong><br />
                      Zero deposit required. Finance provider: [Provider Name]<br />
                      Duration: [Finance Duration]
                    </p>
                  </div>
                )}

                {/* Deposit Total */}
                <div className="bg-slate-100 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Deposit Total:</span>
                    <span className="text-xl font-bold">
                      £{paymentMethod === 'cash' ? parseFloat(depositAmount || '0').toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>

                {/* Confirmation Checkboxes */}
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox 
                      id="funding"
                      checked={confirmFunding}
                      onCheckedChange={(checked) => setConfirmFunding(checked as boolean)}
                    />
                    <Label htmlFor="funding" className="text-sm leading-relaxed">
                      I confirm I've read the funding options
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox 
                      id="terms"
                      checked={confirmTerms}
                      onCheckedChange={(checked) => setConfirmTerms(checked as boolean)}
                    />
                    <Label htmlFor="terms" className="text-sm leading-relaxed">
                      I've read the <a href="#" className="text-primary underline">Terms and Conditions</a>
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox 
                      id="asap"
                      checked={installASAP}
                      onCheckedChange={(checked) => setInstallASAP(checked as boolean)}
                    />
                    <Label htmlFor="asap" className="text-sm leading-relaxed">
                      Install ASAP (optional)
                    </Label>
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  onClick={submitOrder}
                  disabled={!confirmFunding || !confirmTerms}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  Confirm Order and Pay Deposit
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* My Orders Section */}
        {viewMode === 'orders' && (
          <div className="space-y-6">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('dashboard')}
              className="mb-4"
            >
              ← Back to Dashboard
            </Button>
            <h2 className="text-2xl font-bold">My Orders</h2>
            {orders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No orders yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-lg">Order #{order.order_number}</h3>
                            {getStatusBadge(order.status)}
                            <p className="text-sm text-muted-foreground mt-2">
                              <Calendar className="h-4 w-4 inline mr-1" />
                              Created: {new Date(order.created_at).toLocaleDateString()}
                            </p>
                            {order.installation_date && (
                              <p className="text-sm text-green-600 mt-1">
                                <Calendar className="h-4 w-4 inline mr-1" />
                                Scheduled: {new Date(order.installation_date).toLocaleDateString()}
                              </p>
                            )}
                            {order.job_address && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <MapPin className="h-4 w-4 inline mr-1" />
                                {order.job_address}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold">£{order.total_amount}</p>
                            <p className="text-sm text-muted-foreground">
                              Paid: £{order.amount_paid}
                            </p>
                            <Button 
                              size="sm" 
                              className="mt-2"
                              onClick={() => window.open(`/order/${order.id}`, '_blank')}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Order
                            </Button>
                          </div>
                        </div>
                        {order.installation_notes && (
                          <div className="bg-slate-50 p-3 rounded">
                            <p className="text-sm">{order.installation_notes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Balance and Payments Section */}
        {viewMode === 'payments' && (
          <div className="space-y-6">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('dashboard')}
              className="mb-4"
            >
              ← Back to Dashboard
            </Button>
            <h2 className="text-2xl font-bold">Balance & Payments</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Payment Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quotes.map((quote) => {
                    const quotePayments = payments.filter(p => p.quote_id === quote.id);
                    const totalPaid = quotePayments.reduce((sum, p) => sum + p.amount_paid, 0);
                    const remaining = quote.total_cost - totalPaid;
                    
                    return (
                      <div key={quote.id} className="border-b pb-4 last:border-b-0">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{quote.quote_number}</span>
                          {getStatusBadge(quote.status)}
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Total Price:</span>
                            <span>£{quote.total_cost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Deposit Paid:</span>
                            <span className="text-green-600">£{totalPaid.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Balance Remaining:</span>
                            <span>£{remaining.toFixed(2)}</span>
                          </div>
                          {quotePayments.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Payment Method: {quotePayments[0].method}
                            </div>
                          )}
                        </div>
                        {remaining > 0 && quote.status === 'accepted' && (
                          <Button size="sm" className="mt-2">
                            Pay Remaining Balance
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No payments yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {payments.map((payment) => (
                        <div key={payment.id} className="flex justify-between items-center p-3 bg-slate-50 rounded">
                          <div>
                            <p className="font-medium">£{payment.amount_paid.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(payment.paid_on).toLocaleDateString()} • {payment.method}
                            </p>
                          </div>
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* My Details Section */}
        {viewMode === 'details' && (
          <div className="max-w-2xl mx-auto">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('dashboard')}
              className="mb-4"
            >
              ← Back to Dashboard
            </Button>
            <h2 className="text-2xl font-bold mb-6">My Details</h2>
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={client.full_name} readOnly />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={client.email} readOnly />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={client.phone || ''} placeholder="Add phone number" />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea id="address" value={client.address || ''} placeholder="Add address" />
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button>Update Profile</Button>
                  <Button variant="outline">Reset Password</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Help Centre Section */}
        {viewMode === 'help' && (
          <div className="max-w-2xl mx-auto">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('dashboard')}
              className="mb-4"
            >
              ← Back to Dashboard
            </Button>
            <h2 className="text-2xl font-bold mb-6">Help Centre</h2>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Frequently Asked Questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-b pb-4">
                    <h4 className="font-medium mb-2">How do I accept a quote?</h4>
                    <p className="text-sm text-muted-foreground">
                      Go to 'My Quotes', check the box next to 'Click here to proceed with order', then click 'Proceed with Order'.
                    </p>
                  </div>
                  <div className="border-b pb-4">
                    <h4 className="font-medium mb-2">What payment methods do you accept?</h4>
                    <p className="text-sm text-muted-foreground">
                      We accept cash payments with a 25% deposit, or finance options with zero deposit through our approved providers.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">How can I track my order?</h4>
                    <p className="text-sm text-muted-foreground">
                      Visit 'My Orders' to see the current status of all your orders and installation dates.
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="h-4 w-4 mr-2" />
                      Download Funding Guide
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="h-4 w-4 mr-2" />
                      Terms & Conditions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Contact Section */}
        {viewMode === 'contact' && (
          <div className="max-w-4xl mx-auto">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('dashboard')}
              className="mb-4"
            >
              ← Back to Dashboard
            </Button>
            <h2 className="text-2xl font-bold mb-6">Contact Us</h2>
            
            {/* WhatsApp-style messaging */}
            <MessagesSection clientId={client?.id} title="Chat with ProSpaces Team" />
          </div>
        )}

        {/* View Documents Section */}
        {viewMode === 'quote-detail' && (
          <div className="max-w-4xl mx-auto">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('quotes')}
              className="mb-4"
            >
              ← Back to Quotes
            </Button>
            
            <h2 className="text-2xl font-bold mb-6">Documents</h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              {/* Quote PDFs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Quote Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getDocumentsByType('quote').length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No quote documents available</p>
                  ) : (
                    <div className="space-y-2">
                      {getDocumentsByType('quote').map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Room Pack */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Home className="h-5 w-5 mr-2" />
                    Room Pack
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getDocumentsByType('room_pack').length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No room pack documents available</p>
                  ) : (
                    <div className="space-y-2">
                      {getDocumentsByType('room_pack').map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Terms & Conditions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Terms & Conditions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getDocumentsByType('terms').length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No terms documents available</p>
                  ) : (
                    <div className="space-y-2">
                      {getDocumentsByType('terms').map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Funding Guide */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Banknote className="h-5 w-5 mr-2" />
                    Funding Guide
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getDocumentsByType('funding').length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No funding documents available</p>
                  ) : (
                    <div className="space-y-2">
                      {getDocumentsByType('funding').map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Quick Message Modal */}
      {showQuickMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Send Message {selectedQuoteForMessage && `- ${selectedQuoteForMessage.quote_number}`}
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
                          quoteId: selectedQuoteForMessage?.id
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