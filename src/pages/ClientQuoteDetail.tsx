import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, X, Shield, Wrench, MessageCircle, CheckCircle, Package, Award, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

interface Product {
  id: string;
  name: string;
  description: string;
  specifications: any;
  base_price: number;
  category: string;
  images?: ProductImage[];
}

interface ProductImage {
  id: string;
  image_url: string;
  image_name: string;
  is_primary: boolean;
  sort_order: number;
}

interface QuoteItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  configuration: any;
  product?: Product;
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

      // Fetch quote items with product details
      const { data: itemsData, error: itemsError } = await supabase
        .from('quote_items')
        .select(`
          *,
          product:products(
            *,
            images:product_images(*)
          )
        `)
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
      case 'sent': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'accepted': return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      case 'expired': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getProductImage = (item: QuoteItem) => {
    if (item.product?.images && item.product.images.length > 0) {
      const primaryImage = item.product.images.find(img => img.is_primary);
      return primaryImage ? primaryImage.image_url : item.product.images[0].image_url;
    }
    return null;
  };

  const getProductSpecs = (item: QuoteItem) => {
    return item.product?.specifications || {};
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Back Navigation */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/client/quotes')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quotes
          </Button>
        </div>

        <div className="space-y-6">
          {/* Header Section */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent p-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                      Installation Quote
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                      <span className="font-medium">{quote.quote_number}</span>
                      <span>•</span>
                      <span>Created {new Date(quote.created_at).toLocaleDateString()}</span>
                      {quote.expires_at && (
                        <>
                          <span>•</span>
                          <span className="text-orange-600 font-medium">
                            Expires {new Date(quote.expires_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge 
                    className={`${getStatusColor(quote.status)} border rounded-full px-4 py-2 font-medium`}
                  >
                    {formatStatus(quote.status)}
                  </Badge>
                </div>
                
                {/* Total Investment Block */}
                <div className="mt-8 bg-card rounded-xl p-6 border shadow-sm">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary mb-2">
                      £{quote.total_cost.toFixed(2)}
                    </div>
                    <p className="text-muted-foreground">All-inclusive professional installation</p>
                  </div>
                </div>

                {/* Action Buttons */}
                {quote.status === 'sent' ? (
                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleAcceptQuote}
                      disabled={accepting}
                      size="lg"
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full"
                    >
                      {accepting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      ) : (
                        <Check className="h-5 w-5 mr-2" />
                      )}
                      Accept Quote
                    </Button>
                    <Button
                      onClick={handleRejectQuote}
                      disabled={rejecting}
                      variant="outline"
                      size="lg"
                      className="rounded-full border-2"
                    >
                      {rejecting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      ) : (
                        <X className="h-4 w-4 mr-2" />
                      )}
                      Decline
                    </Button>
                  </div>
                ) : (
                  <div className="mt-6 p-4 bg-card rounded-lg border">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span>
                        You have {quote.status === 'accepted' ? 'accepted' : 'declined'} this quote
                        {quote.status === 'accepted' && ' - proceeding to installation scheduling'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Trust & Reassurance Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-md transition-all">
              <div className="text-center">
                <div className="inline-flex p-3 bg-green-600 rounded-full mb-3">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-green-800 mb-1">5 Year Warranty</h4>
                <p className="text-xs text-green-600">Comprehensive coverage</p>
              </div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-md transition-all">
              <div className="text-center">
                <div className="inline-flex p-3 bg-blue-600 rounded-full mb-3">
                  <Wrench className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-blue-800 mb-1">Professional Installation</h4>
                <p className="text-xs text-blue-600">Certified engineers</p>
              </div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-md transition-all">
              <div className="text-center">
                <div className="inline-flex p-3 bg-purple-600 rounded-full mb-3">
                  <MessageCircle className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-purple-800 mb-1">Free Consultation</h4>
                <p className="text-xs text-purple-600">Expert guidance included</p>
              </div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-md transition-all">
              <div className="text-center">
                <div className="inline-flex p-3 bg-orange-600 rounded-full mb-3">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-orange-800 mb-1">Quality Guarantee</h4>
                <p className="text-xs text-orange-600">100% satisfaction</p>
              </div>
            </Card>
          </div>

          {/* Product Details Section */}
          {quoteItems.length > 0 && (
            <div className="space-y-6">
              {quoteItems.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="lg:grid lg:grid-cols-5 lg:gap-8">
                      {/* Product Image */}
                      <div className="lg:col-span-2 p-6">
                        {getProductImage(item) ? (
                          <div className="aspect-square bg-muted rounded-xl overflow-hidden">
                            <img
                              src={getProductImage(item)}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-square bg-muted rounded-xl flex items-center justify-center">
                            <Package className="h-16 w-16 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="lg:col-span-3 p-6">
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-2xl font-bold mb-2">{item.product_name}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                              {item.product?.description || quote.product_details}
                            </p>
                          </div>

                          {/* Specifications Grid */}
                          {Object.keys(getProductSpecs(item)).length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-4 text-lg">Technical Specifications</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(getProductSpecs(item)).map(([key, value]) => (
                                  <div key={key} className="flex justify-between items-center py-2 border-b border-border">
                                    <span className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                                      {key}
                                    </span>
                                    <span className="font-medium">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Pricing */}
                          <div className="bg-muted rounded-lg p-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                                <p className="text-sm text-muted-foreground">Unit Price: £{item.unit_price.toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-primary">£{item.total_price.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Quote Summary */}
              <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold">Quote Summary</h3>
                    
                    {/* Subtotal */}
                    <div className="space-y-2">
                      {quoteItems.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                          <span>{item.product_name} (x{item.quantity})</span>
                          <span>£{item.total_price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-xl font-bold">
                        <span>Total</span>
                        <span className="text-primary">£{quote.total_cost.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Including professional installation and 5-year warranty
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Additional Notes */}
          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{quote.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Help Section */}
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="inline-flex p-3 bg-blue-600 rounded-full">
                  <MessageCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">Need to Make Changes?</h3>
                  <p className="text-blue-700 mb-4">
                    Our expert team is ready to help customize this quote to perfectly match your needs.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    variant="outline" 
                    className="border-blue-300 text-blue-700 hover:bg-blue-200 rounded-full"
                    onClick={() => navigate('/client/messages')}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-blue-300 text-blue-700 hover:bg-blue-200 rounded-full"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Call
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}