import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, X, Shield, Wrench, MessageCircle, CheckCircle, Package, Award, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrandButton } from '@/components/brand/BrandButton';
import { getStatusColor } from '@/lib/brandUtils';

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
  const [previousSnapshot, setPreviousSnapshot] = useState<any>(null);

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

      // Fetch previous quote snapshot for comparison
      if (quoteData.order_id) {
        const { data: snapshotData } = await supabase
          .from('order_quote_snapshots')
          .select('quote_data, created_at, revision_reason')
          .eq('order_id', quoteData.order_id)
          .neq('quote_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (snapshotData) {
          setPreviousSnapshot(snapshotData);
        }
      }
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
                          <span className="text-destructive font-medium">
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
                    <BrandButton
                      onClick={handleAcceptQuote}
                      disabled={accepting}
                      size="lg"
                      brandVariant="primary"
                      className="flex-1 rounded-full"
                    >
                      {accepting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      ) : (
                        <Check className="h-5 w-5 mr-2" />
                      )}
                      Accept Quote
                    </BrandButton>
                    <BrandButton
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
                    </BrandButton>
                  </div>
                ) : (
                  <div className="mt-6 p-4 bg-card rounded-lg border">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-5 w-5 text-accent" />
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

          {/* Changes Since Last Quote */}
          {previousSnapshot && (
            <Card className="bg-gradient-subtle border-accent/20">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-accent rounded-full"></div>
                    <h3 className="font-semibold text-foreground">Changes Since Last Quote</h3>
                  </div>
                  
                  {previousSnapshot.revision_reason && (
                    <div className="bg-card/50 rounded-lg p-4 border">
                      <p className="text-sm font-medium text-foreground mb-1">Reason for Revision</p>
                      <p className="text-muted-foreground">{previousSnapshot.revision_reason}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Previous Total</p>
                      <p className="text-xl font-bold text-foreground">
                        £{(previousSnapshot.quote_data.total_cost || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">New Total</p>
                      <p className="text-xl font-bold text-foreground">
                        £{quote.total_cost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  {(() => {
                    const difference = quote.total_cost - (previousSnapshot.quote_data.total_cost || 0);
                    const isIncrease = difference > 0;
                    const absChange = Math.abs(difference);
                    
                    if (difference !== 0) {
                      return (
                        <div className={`text-center p-3 rounded-lg ${isIncrease ? 'bg-destructive/10 border border-destructive/20' : 'bg-accent/10 border border-accent/20'}`}>
                          <p className={`font-semibold ${isIncrease ? 'text-destructive' : 'text-accent'}`}>
                            Price {isIncrease ? 'increased' : 'decreased'} by £{absChange.toFixed(2)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trust & Reassurance Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 brand-card-interactive hover:shadow-md transition-all">
              <div className="text-center">
                <div className="icon-bg-teal p-3 rounded-full mb-3 inline-flex">
                  <Shield className="h-6 w-6 text-primary-foreground" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">5 Year Warranty</h4>
                <p className="text-xs text-muted-foreground">Comprehensive coverage</p>
              </div>
            </Card>
            
            <Card className="p-4 brand-card-interactive hover:shadow-md transition-all">
              <div className="text-center">
                <div className="icon-bg-pink p-3 rounded-full mb-3 inline-flex">
                  <Wrench className="h-6 w-6 text-primary-foreground" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">Professional Installation</h4>
                <p className="text-xs text-muted-foreground">Certified engineers</p>
              </div>
            </Card>
            
            <Card className="p-4 brand-card-interactive hover:shadow-md transition-all">
              <div className="text-center">
                <div className="icon-bg-cream p-3 rounded-full mb-3 inline-flex">
                  <MessageCircle className="h-6 w-6 text-foreground" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">Free Consultation</h4>
                <p className="text-xs text-muted-foreground">Expert guidance included</p>
              </div>
            </Card>
            
            <Card className="p-4 brand-card-interactive hover:shadow-md transition-all">
              <div className="text-center">
                <div className="icon-bg-teal p-3 rounded-full mb-3 inline-flex">
                  <Award className="h-6 w-6 text-primary-foreground" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">Quality Guarantee</h4>
                <p className="text-xs text-muted-foreground">100% satisfaction</p>
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
          <Card className="brand-card">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="icon-bg-pink p-3 rounded-full inline-flex">
                  <MessageCircle className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Need to Make Changes?</h3>
                  <p className="text-muted-foreground mb-4">
                    Our expert team is ready to help customize this quote to perfectly match your needs.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <BrandButton 
                    variant="outline" 
                    brandVariant="secondary"
                    className="rounded-full"
                    onClick={() => navigate('/client/messages')}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Send Message
                  </BrandButton>
                  <BrandButton 
                    variant="outline" 
                    brandVariant="secondary"
                    className="rounded-full"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Call
                  </BrandButton>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}