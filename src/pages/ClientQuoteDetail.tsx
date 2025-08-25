import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Check, X, Shield, Wrench, MessageCircle, CheckCircle, Phone, Mail, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrandCard } from '@/components/brand/BrandCard';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  total_cost: number;
  created_at: string;
  expires_at: string | null;
  product_details: string;
  notes: string | null;
  share_token: string | null;
  is_shareable: boolean;
}

interface QuoteItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  configuration: any;
}

export default function ClientQuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    fetchQuoteDetails();
  }, [user, id]);

  const fetchQuoteDetails = async () => {
    try {
      setLoading(true);

      // Get client first
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (clientError || !clientData) {
        toast({
          title: "Error",
          description: 'Failed to load client data',
          variant: "destructive",
        });
        navigate('/client');
        return;
      }

      // Fetch quote details
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', id)
        .eq('client_id', clientData.id)
        .single();

      if (quoteError || !quoteData) {
        toast({
          title: "Error",
          description: 'Quote not found',
          variant: "destructive",
        });
        navigate('/client/quotes');
        return;
      }

      // Fetch quote items
      const { data: itemsData, error: itemsError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', id);

      if (itemsError) {
        console.error('Error loading quote items:', itemsError);
        toast({
          title: "Error",
          description: 'Failed to load quote items',
          variant: "destructive",
        });
        return;
      }

      setQuote(quoteData);
      setQuoteItems(itemsData || []);
    } catch (error) {
      console.error('Error in fetchQuoteDetails:', error);
      toast({
        title: "Error",
        description: 'Failed to load quote details',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptQuote = async () => {
    if (!quote) return;

    try {
      console.log('Starting quote acceptance...', { quoteId: quote.id });
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session);
      
      if (!session) {
        console.log('No session found, redirecting to auth');
        toast({
          title: "Authentication Required",
          description: 'Please log in to accept quotes',
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }
      
      setAccepting(true);
      
      const { data, error } = await supabase.functions.invoke('client-accept-quote', {
        body: { quoteId: quote.id }
      });

      console.log('Function response:', { data, error });

      if (error) throw error;

      toast({
        title: "Success",
        description: 'Quote accepted! Creating your order...',
      });
      
      // Add a small delay to ensure database consistency before redirect
      setTimeout(() => {
        navigate(`/client/orders/${data.orderId}`);
      }, 1500);
    } catch (error) {
      console.error('Error accepting quote:', error);
      toast({
        title: "Error",
        description: 'Failed to accept quote. Please try logging in again.',
        variant: "destructive",
      });
      setAccepting(false);
    }
  };

  const handleRejectQuote = async () => {
    if (!quote) return;

    try {
      setRejecting(true);
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'rejected' })
        .eq('id', quote.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: 'Quote rejected',
      });
      setQuote({ ...quote, status: 'rejected' });
    } catch (error) {
      console.error('Error rejecting quote:', error);
      toast({
        title: "Error",
        description: 'Failed to reject quote',
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Quote not found</p>
          <Button onClick={() => navigate('/client/quotes')} className="mt-4">
            Back to Quotes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Enhanced Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/client/quotes')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quotes
          </Button>
        </div>

        {/* Quote Summary Card */}
        <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-primary">Your Installation Quote</h1>
                <p className="text-lg text-muted-foreground mt-1">
                  {quote.quote_number} • Created {new Date(quote.created_at).toLocaleDateString()}
                </p>
                {quote.expires_at && (
                  <p className="text-sm text-orange-600 font-medium">
                    Expires {new Date(quote.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Badge className={getStatusColor(quote.status)} variant="secondary">
                {formatStatus(quote.status)}
              </Badge>
            </div>
            
            {/* Total Price Highlight */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-xl font-semibold">Total Investment</span>
                <span className="text-3xl font-bold text-primary">£{quote.total_cost.toFixed(2)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">All-inclusive professional installation</p>
            </div>

            {/* Primary CTA - Only show for sent quotes */}
            {quote.status === 'sent' && (
              <div className="mt-6 pt-4 border-t">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleAcceptQuote}
                    disabled={accepting}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium py-3 text-lg"
                    size="lg"
                  >
                    {accepting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Check className="h-5 w-5 mr-2" />
                    )}
                    Accept Quote & Continue
                  </Button>
                  <Button
                    onClick={handleRejectQuote}
                    disabled={rejecting}
                    variant="outline"
                    size="lg"
                    className="text-gray-600 border-gray-300 hover:bg-gray-50"
                  >
                    {rejecting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Decline
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  By accepting, you'll move straight to scheduling your installation
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trust Elements */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center bg-green-50 border-green-200">
            <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-semibold text-green-800 text-sm">5 Year Warranty</h4>
            <p className="text-xs text-green-600">Comprehensive coverage</p>
          </Card>
          
          <Card className="p-4 text-center bg-blue-50 border-blue-200">
            <Wrench className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <h4 className="font-semibold text-blue-800 text-sm">Professional Installation</h4>
            <p className="text-xs text-blue-600">Certified technicians</p>
          </Card>
          
          <Card className="p-4 text-center bg-purple-50 border-purple-200">
            <MessageCircle className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <h4 className="font-semibold text-purple-800 text-sm">Free Consultation</h4>
            <p className="text-xs text-purple-600">Expert guidance</p>
          </Card>
          
          <Card className="p-4 text-center bg-orange-50 border-orange-200">
            <CheckCircle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <h4 className="font-semibold text-orange-800 text-sm">Quality Guarantee</h4>
            <p className="text-xs text-orange-600">100% satisfaction</p>
          </Card>
        </div>

        {/* Product Information & Quote Items */}
        <Card>
          <CardHeader>
            <CardTitle>What's Included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Product Details</h3>
                <p className="text-muted-foreground">{quote.product_details}</p>
              </div>

              {quoteItems.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Quote Items</h3>
                  <div className="space-y-3">
                    {quoteItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-4 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                        </div>
                        <p className="font-semibold text-lg">£{item.total_price.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* What's Always Included */}
              <div>
                <h3 className="font-semibold mb-3">Always Included at No Extra Cost</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <Wrench className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Professional installation</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">Included</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">5 year warranty</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">Included</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Free consultation</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">Included</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Quality guarantee</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">Included</span>
                  </div>
                </div>
              </div>

              <Separator />
              
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Total</span>
                <span className="text-primary">£{quote.total_cost.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collapsible Quote Details */}
        <Collapsible open={detailsExpanded} onOpenChange={setDetailsExpanded}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <span>Quote Details & Notes</span>
                  {detailsExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {quote.notes ? (
                  <div>
                    <h4 className="font-semibold mb-2">Notes</h4>
                    <p className="text-muted-foreground">{quote.notes}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No additional notes for this quote.</p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Help Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <HelpCircle className="h-6 w-6 text-blue-600 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">Need Changes or Have Questions?</h3>
                <p className="text-blue-700 mb-4">
                  Our team is here to help! If you'd like to modify this quote or have any questions, get in touch with us.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    variant="outline" 
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={() => window.open('/client/messages', '_blank')}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Chat with us
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={() => window.open('tel:+441234567890')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call us now
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={() => window.open('mailto:support@proev.co.uk')}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email support
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}