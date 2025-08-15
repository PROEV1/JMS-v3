import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, Share2, Calendar, Shield, Wrench, Mail, MessageCircle, Copy, Link } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProSpacesLogo } from '@/components/ProSpacesLogo';
import livingRoomImg from '@/assets/living-room-placeholder.jpg';
import laptopImg from '@/assets/laptop-placeholder.jpg';
import workspaceImg from '@/assets/workspace-placeholder.jpg';

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
  warranty_period: string;
  includes_installation: boolean;
  special_instructions: string;
  client: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface QuoteItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  configuration: any;
  product: {
    id: string;
    name: string;
    description: string;
    category: string;
    specifications: any;
    images: Array<{
      image_url: string;
      image_name: string;
      is_primary: boolean;
    }>;
  };
}

interface ProductCompatibility {
  core_product_id: string;
  accessory_product_id: string;
}

export default function PublicQuoteView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { toast } = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [compatibilities, setCompatibilities] = useState<ProductCompatibility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shareToken) {
      fetchQuote();
    }
  }, [shareToken]);

  const fetchQuote = async () => {
    try {
      // First fetch the quote by share_token
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(id, full_name, email)
        `)
        .eq('share_token', shareToken)
        .eq('is_shareable', true)
        .single();

      if (quoteError) throw quoteError;
      setQuote(quoteData);

      // Then fetch quote items
      const { data: itemsData, error: itemsError } = await supabase
        .from('quote_items')
        .select(`
          *,
          product:products(
            id,
            name,
            description,
            category,
            specifications,
            images:product_images(
              image_url,
              image_name,
              is_primary
            )
          )
        `)
        .eq('quote_id', quoteData.id);

      if (itemsError) throw itemsError;
      setQuoteItems(itemsData || []);

      // Fetch product compatibility relationships
      const { data: compatibilityData, error: compatibilityError } = await supabase
        .from('product_compatibility')
        .select('core_product_id, accessory_product_id');

      if (compatibilityError) throw compatibilityError;
      setCompatibilities(compatibilityData || []);
    } catch (error) {
      console.error('Error fetching quote:', error);
      toast({
        title: "Error",
        description: "Could not load quote. The link may be invalid or expired.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getProductImage = (item: QuoteItem) => {
    // First, check if the product has uploaded images
    if (item.product?.images && item.product.images.length > 0) {
      const primaryImage = item.product.images.find(img => img.is_primary);
      return primaryImage ? primaryImage.image_url : item.product.images[0].image_url;
    }
    
    // Fallback to placeholder images
    return getPlaceholderImage(item.product_name);
  };

  const getPlaceholderImage = (productName: string) => {
    const name = productName.toLowerCase();
    if (name.includes('living') || name.includes('room') || name.includes('sofa')) {
      return livingRoomImg;
    } else if (name.includes('office') || name.includes('desk') || name.includes('workspace')) {
      return workspaceImg;
    } else {
      return laptopImg;
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
      case 'sent': return 'bg-brand-teal text-white';
      case 'accepted': return 'bg-brand-green text-white';
      case 'declined': return 'bg-destructive text-destructive-foreground';
      case 'expired': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const shareViaEmail = () => {
    if (!quote) return;
    
    const shareUrl = window.location.href;
    const subject = `Quote ${quote.quote_number} from ProSpaces`;
    const body = `Hi,\n\nI'm sharing a quote from ProSpaces with you.\n\nQuote Number: ${quote.quote_number}\nTotal: ${formatCurrency(quote.total_cost)}\n\nView the full quote here: ${shareUrl}\n\nBest regards`;
    
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  const shareViaWhatsApp = () => {
    if (!quote) return;
    
    const shareUrl = window.location.href;
    const message = `Hi! I'm sharing a quote from ProSpaces with you.\n\n*Quote ${quote.quote_number}*\nTotal: ${formatCurrency(quote.total_cost)}\n\nView the full quote: ${shareUrl}`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Quote link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const nativeShare = async () => {
    if (!quote) return;
    
    if (navigator.share && navigator.canShare) {
      try {
        await navigator.share({
          title: `Quote ${quote.quote_number}`,
          text: 'Check out this quote from ProSpaces',
          url: window.location.href,
        });
      } catch (error) {
        // Fall back to clipboard
        copyShareLink();
      }
    } else {
      // Fall back to clipboard
      copyShareLink();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-teal"></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="brand-heading-1">Quote Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground brand-body">
              The quote you're looking for could not be found or may no longer be available for sharing.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <ProSpacesLogo variant="main" size="lg" />
          <div className="flex space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={shareViaEmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  Share via Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareViaWhatsApp}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Share via WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyShareLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={nativeShare}>
                  <Link className="h-4 w-4 mr-2" />
                  Native Share
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quote Header */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl brand-heading-1">Quote {quote.quote_number}</CardTitle>
                  <p className="text-muted-foreground brand-body">For {quote.client.full_name}</p>
                </div>
                <div className="text-right">
                  <Badge className={getStatusColor(quote.status)}>
                    {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                  </Badge>
                  {quote.expires_at && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Expires: {new Date(quote.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Quote Items */}
          <div className="space-y-6">
            {(() => {
              const coreProducts = quoteItems.filter(item => item.product?.category === 'Core');
              const accessories = quoteItems.filter(item => item.product?.category === 'Accessories');
              
              return coreProducts.map((coreItem) => {
                // Find compatible accessories for this core product
                const compatibleAccessoryIds = compatibilities
                  .filter(comp => comp.core_product_id === coreItem.product.id)
                  .map(comp => comp.accessory_product_id);
                
                const relatedAccessories = accessories.filter(acc => 
                  compatibleAccessoryIds.includes(acc.product.id)
                );

                return (
                  <Card key={coreItem.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="md:flex">
                        {/* Product Image */}
                        <div className="md:w-1/2">
                          <div className="relative h-64 md:h-full">
                            <img
                              src={getProductImage(coreItem)}
                              alt={coreItem.product_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>

                        {/* Product Details */}
                        <div className="md:w-1/2 p-6">
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-xl font-semibold brand-heading-3">{coreItem.product_name}</h3>
                              {coreItem.product?.description && (
                                <p className="text-muted-foreground mt-2 brand-body">{coreItem.product.description}</p>
                              )}
                            </div>

                            {/* Configuration Details */}
                            {coreItem.configuration && Object.keys(coreItem.configuration).length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2">Configuration:</h4>
                                <div className="space-y-1">
                                  {Object.entries(coreItem.configuration).map(([key, value]) => (
                                    <div key={key} className="flex justify-between text-sm">
                                      <span className="capitalize">{key.replace('_', ' ')}:</span>
                                      <span>{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Accessories Section */}
                            {relatedAccessories.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-3">Accessories</h4>
                                <div className="space-y-2">
                                  {relatedAccessories.map((accessory) => (
                                    <div key={accessory.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                                      <div className="w-12 h-12 flex-shrink-0">
                                        <img
                                          src={getProductImage(accessory)}
                                          alt={accessory.product_name}
                                          className="w-full h-full object-cover rounded"
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{accessory.product_name}</p>
                                        <p className="text-xs text-muted-foreground">Qty: {accessory.quantity}</p>
                                      </div>
                                      <div className="text-sm font-medium">
                                        +{formatCurrency(accessory.total_price)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Standard Free Items */}
                            <div>
                              <h4 className="font-medium mb-3">Always Included</h4>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <Wrench className="h-4 w-4 text-brand-green" />
                                    <span className="text-sm">Professional installation by certified team</span>
                                  </div>
                                  <span className="text-sm font-medium text-brand-green">Free</span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <Wrench className="h-4 w-4 text-brand-green" />
                                    <span className="text-sm">Stud Wall Removal</span>
                                  </div>
                                  <span className="text-sm font-medium text-brand-green">Free</span>
                                </div>
                              </div>
                            </div>

                            {/* Pricing Summary */}
                            <div className="space-y-2 pt-4 border-t">
                              <div className="flex justify-between text-lg font-semibold">
                                <span>{coreItem.product_name}:</span>
                                <span>{formatCurrency(coreItem.total_price)}</span>
                              </div>
                              {relatedAccessories.length > 0 && (
                                <div className="flex justify-between text-sm text-muted-foreground">
                                  <span>Accessories:</span>
                                  <span>+{formatCurrency(relatedAccessories.reduce((sum, acc) => sum + acc.total_price, 0))}</span>
                                </div>
                              )}
                              <Separator />
                              <div className="flex justify-between font-semibold text-xl">
                                <span>Total:</span>
                                <span>{formatCurrency(coreItem.total_price + relatedAccessories.reduce((sum, acc) => sum + acc.total_price, 0))}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              });
            })()}
          </div>

          {/* What's Always Included */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2 text-brand-green" />
                What's Always Included
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-brand-green rounded-full"></div>
                  <span>{quote.warranty_period} warranty</span>
                </div>
                {quote.includes_installation && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-brand-green rounded-full"></div>
                    <span>Professional installation</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-brand-green rounded-full"></div>
                  <span>Free consultation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-brand-green rounded-full"></div>
                  <span>Quality guarantee</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Materials Cost:</span>
                  <span>{formatCurrency(quote.materials_cost)}</span>
                </div>
                {quote.includes_installation && (
                  <div className="flex justify-between">
                    <span>Installation Cost:</span>
                    <span>{formatCurrency(quote.install_cost)}</span>
                  </div>
                )}
                {quote.extras_cost > 0 && (
                  <div className="flex justify-between">
                    <span>Extras:</span>
                    <span>{formatCurrency(quote.extras_cost)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total Cost:</span>
                  <span>{formatCurrency(quote.total_cost)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What Happens Next */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-brand-teal" />
                What Happens Next?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-brand-teal text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                  <div>
                    <h4 className="font-medium">Accept Your Quote</h4>
                    <p className="text-sm text-muted-foreground">Review and accept your personalized quote</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-brand-teal text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                  <div>
                    <h4 className="font-medium">Schedule Installation</h4>
                    <p className="text-sm text-muted-foreground">Book a convenient time for professional installation</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-brand-teal text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                  <div>
                    <h4 className="font-medium">Enjoy Your New Space</h4>
                    <p className="text-sm text-muted-foreground">Relax while we transform your space</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Special Instructions */}
          {quote.special_instructions && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wrench className="h-5 w-5 mr-2 text-brand-pink" />
                  Special Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{quote.special_instructions}</p>
              </CardContent>
            </Card>
          )}

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact ProSpaces</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Questions about this quote? Contact us at {quote.client.email} or reach out to our team for more information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}