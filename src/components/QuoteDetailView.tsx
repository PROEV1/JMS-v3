import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronLeft, Download, Share2, Eye, Calendar, Shield, Wrench, CheckCircle, Mail, MessageCircle, Link, Copy, Edit, Clock, CheckCircle2, XCircle, User, MapPin, Phone } from 'lucide-react';
import { ImageModal } from '@/components/ui/ImageModal';
import livingRoomImg from '@/assets/living-room-placeholder.jpg';
import laptopImg from '@/assets/laptop-placeholder.jpg';
import workspaceImg from '@/assets/workspace-placeholder.jpg';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  client: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    address: string | null;
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
  } | null;
}

interface ProductCompatibility {
  core_product_id: string;
  accessory_product_id: string;
}

interface QuoteDetailViewProps {
  quote: Quote;
  onBack: () => void;
  onAccept?: (quoteId: string) => void;
  onReject?: (quoteId: string) => void;
  order?: {
    id: string;
    order_number: string;
    status: string;
  } | null;
}

export const QuoteDetailView: React.FC<QuoteDetailViewProps> = ({ quote, onBack, onAccept, onReject, order }) => {
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [compatibilities, setCompatibilities] = useState<ProductCompatibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuoteItems();
  }, [quote.id]);

  const fetchQuoteItems = async () => {
    try {
      // Fetch quote items with product data and compatibility info
      const { data, error } = await supabase
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
        .eq('quote_id', quote.id);

      if (error) throw error;
      setQuoteItems(data || []);

      // Fetch product compatibility relationships
      const { data: compatibilityData, error: compatibilityError } = await supabase
        .from('product_compatibility')
        .select('core_product_id, accessory_product_id');

      if (compatibilityError) throw compatibilityError;
      setCompatibilities(compatibilityData || []);
    } catch (error) {
      console.error('Error fetching quote items:', error);
      toast({
        title: "Error",
        description: "Failed to load quote details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-quote-pdf', {
        body: { quoteId: quote.id }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to generate PDF');
      }

      if (!data || !data.pdfUrl) {
        throw new Error('No PDF URL returned from server');
      }

      // Create download link
      const link = document.createElement('a');
      link.href = data.pdfUrl;
      link.download = `Quote-${quote.quote_number}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Success",
        description: "Quote PDF downloaded successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const shareQuote = async () => {
    try {
      let shareToken = quote.share_token;
      
      // If no share token exists, generate one
      if (!shareToken) {
        const newShareToken = btoa(Math.random().toString()).substring(0, 32);
        
        const { error: updateError } = await supabase
          .from('quotes')
          .update({ 
            is_shareable: true,
            share_token: newShareToken
          })
          .eq('id', quote.id);

        if (updateError) throw updateError;
        shareToken = newShareToken;
      } else {
        // Just enable sharing
        const { error } = await supabase
          .from('quotes')
          .update({ is_shareable: true })
          .eq('id', quote.id);

        if (error) throw error;
      }

      // Generate share URL
      const shareUrl = `${window.location.origin}/quote/${shareToken}`;
      
      // Try to use native share API if available
      if (navigator.share && navigator.canShare) {
        try {
          await navigator.share({
            title: `Quote ${quote.quote_number}`,
            text: 'Check out this quote from Pro EV',
            url: shareUrl,
          });
          return;
        } catch (shareError) {
          // Fall back to clipboard if share was cancelled or failed
          console.log('Native share cancelled or failed, using clipboard');
        }
      }
      
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied",
        description: "Quote share link copied to clipboard",
      });
      
    } catch (error) {
      console.error('Error sharing quote:', error);
      toast({
        title: "Error", 
        description: "Failed to share quote. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-primary text-white';
      case 'accepted': return 'bg-brand-teal text-white';
      case 'rejected': return 'bg-destructive text-destructive-foreground';
      case 'declined': return 'bg-destructive text-destructive-foreground';
      case 'expired': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getPlaceholderImage = (productName: string) => {
    // Simple logic to assign different placeholder images
    const name = productName.toLowerCase();
    if (name.includes('living') || name.includes('room') || name.includes('sofa')) {
      return livingRoomImg;
    } else if (name.includes('office') || name.includes('desk') || name.includes('workspace')) {
      return workspaceImg;
    } else {
      return laptopImg;
    }
  };

  const getProductImage = (item: QuoteItem) => {
    // First, check if the product has uploaded images
    if (item.product?.images && item.product.images.length > 0) {
      // Find primary image or use the first one
      const primaryImage = item.product.images.find(img => img.is_primary);
      return primaryImage ? primaryImage.image_url : item.product.images[0].image_url;
    }
    
    // Fallback to placeholder images
    return getPlaceholderImage(item.product_name);
  };

  const isCustomLineItem = (item: QuoteItem) => {
    return !item.product || !item.product.id;
  };

  const shareViaEmail = async () => {
    try {
      let shareToken = quote.share_token;
      
      if (!shareToken) {
        const newShareToken = btoa(Math.random().toString()).substring(0, 32);
        const { error: updateError } = await supabase
          .from('quotes')
          .update({ 
            is_shareable: true,
            share_token: newShareToken
          })
          .eq('id', quote.id);

        if (updateError) throw updateError;
        shareToken = newShareToken;
      }

      const shareUrl = `${window.location.origin}/quote/${shareToken}`;
      const subject = `Quote ${quote.quote_number} from Pro EV`;
      const body = `Hi,\n\nI'm sharing a quote from Pro EV with you.\n\nQuote Number: ${quote.quote_number}\nTotal: ${formatCurrency(quote.total_cost)}\n\nView the full quote here: ${shareUrl}\n\nBest regards`;
      
      const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink, '_blank');

      toast({
        title: "Email Opened",
        description: "Email client opened with quote details",
      });
    } catch (error) {
      console.error('Error sharing via email:', error);
      toast({
        title: "Error",
        description: "Failed to prepare email",
        variant: "destructive",
      });
    }
  };

  const shareViaWhatsApp = async () => {
    try {
      let shareToken = quote.share_token;
      
      if (!shareToken) {
        const newShareToken = btoa(Math.random().toString()).substring(0, 32);
        const { error: updateError } = await supabase
          .from('quotes')
          .update({ 
            is_shareable: true,
            share_token: newShareToken
          })
          .eq('id', quote.id);

        if (updateError) throw updateError;
        shareToken = newShareToken;
      }

      const shareUrl = `${window.location.origin}/quote/${shareToken}`;
      const message = `Hi! I'm sharing a quote from Pro EV with you.\n\n*Quote ${quote.quote_number}*\nTotal: ${formatCurrency(quote.total_cost)}\n\nView the full quote: ${shareUrl}`;
      
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      toast({
        title: "WhatsApp Opened",
        description: "WhatsApp opened with quote details",
      });
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      toast({
        title: "Error", 
        description: "Failed to prepare WhatsApp message",
        variant: "destructive",
      });
    }
  };

  const copyShareLink = async () => {
    try {
      let shareToken = quote.share_token;
      
      if (!shareToken) {
        const newShareToken = btoa(Math.random().toString()).substring(0, 32);
        const { error: updateError } = await supabase
          .from('quotes')
          .update({ 
            is_shareable: true,
            share_token: newShareToken
          })
          .eq('id', quote.id);

        if (updateError) throw updateError;
        shareToken = newShareToken;
      }

      const shareUrl = `${window.location.origin}/quote/${shareToken}`;
      await navigator.clipboard.writeText(shareUrl);
      
      toast({
        title: "Link Copied",
        description: "Quote link copied to clipboard",
      });
    } catch (error) {
      console.error('Error copying link:', error);
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleAcceptQuote = () => {
    if (onAccept) {
      onAccept(quote.id);
    }
  };

  const handleRejectQuote = () => {
    if (onReject) {
      onReject(quote.id);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Admin Header with Client Metadata */}
      <div className="space-y-4">
        {/* Back Button */}
        <div>
          <Button variant="ghost" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Quotes
          </Button>
        </div>

        {/* Client & Quote Metadata Header */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold brand-heading-1">Quote {quote.quote_number}</h1>
                  <Badge className={getStatusColor(quote.status)}>
                    {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{quote.client.full_name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{quote.client.email}</span>
                  </div>
                  {quote.client.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{quote.client.phone}</span>
                    </div>
                  )}
                  {quote.client.address && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{quote.client.address}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <span>Created: {new Date(quote.created_at).toLocaleDateString()}</span>
                  <span>Value: {formatCurrency(quote.total_cost)}</span>
                  {quote.expires_at && (
                    <span>Expires: {new Date(quote.expires_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {/* Enhanced Action Buttons with Hierarchy */}
              <div className="flex flex-col items-end space-y-2">
                <div className="flex space-x-2">
                  {quote.status === 'draft' && (
                    <Button 
                      onClick={async () => {
                        try {
                          // Send quote via email
                          const { error: emailError } = await supabase.functions.invoke('send-revised-quote', {
                            body: {
                              quoteId: quote.id,
                              revisionReason: 'Quote sent to client'
                            }
                          });
                          
                          if (emailError) throw emailError;
                          
                          toast({
                            title: "Quote Sent",
                            description: "Quote has been emailed to client and status updated",
                          });
                          
                          // Refresh the page to show updated status
                          window.location.reload();
                        } catch (error) {
                          console.error('Error sending quote:', error);
                          toast({
                            title: "Error",
                            description: "Failed to send quote",
                            variant: "destructive",
                          });
                        }
                      }}
                      size="sm" 
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send to Client
                    </Button>
                  )}
                  {quote.status === 'sent' && (
                    <>
                      <Button onClick={handleAcceptQuote} size="sm" className="bg-brand-teal hover:bg-brand-teal-dark text-white font-medium">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accept Quote
                      </Button>
                      <Button onClick={handleRejectQuote} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                  {quote.status === 'accepted' && order && (
                    <Button 
                      onClick={() => window.open(`/orders/${order.id}`, '_blank')}
                      size="sm"
                      className="bg-brand-blue hover:bg-brand-blue-dark text-white"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Order
                    </Button>
                  )}
                  {quote.status === 'rejected' && (
                    <Button onClick={handleAcceptQuote} size="sm" className="bg-brand-teal hover:bg-brand-teal-dark text-white">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept Quote
                    </Button>
                  )}
                </div>
                
                {/* Secondary Actions - Smaller Icons */}
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => window.location.href = `/admin/quotes/${quote.id}/edit`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => window.open(`/admin/messages?client=${quote.client.id}`, '_blank')}>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={shareViaEmail}>
                        <Mail className="h-4 w-4 mr-2" />
                        Share via Email
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyShareLink}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="sm" onClick={generatePDF} disabled={generating}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Workflow Timeline */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Quote Workflow</h4>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-xs">Created</span>
                </div>
                <div className="flex-1 h-px bg-muted"></div>
                <div className="flex items-center space-x-1">
                <div className={`h-4 w-4 rounded-full flex items-center justify-center ${quote.status === 'sent' || quote.status === 'accepted' || quote.status === 'rejected' ? 'bg-green-600' : 'bg-muted'}`}>
                  {(quote.status === 'sent' || quote.status === 'accepted' || quote.status === 'rejected') ? (
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  ) : (
                    <div className="h-2 w-2 bg-white rounded-full"></div>
                  )}
                </div>
                  <span className="text-xs">Sent</span>
                </div>
                <div className="flex-1 h-px bg-muted"></div>
                <div className="flex items-center space-x-1">
                  <div className={`h-4 w-4 rounded-full flex items-center justify-center ${quote.status === 'accepted' ? 'bg-green-600' : quote.status === 'rejected' ? 'bg-red-600' : 'bg-muted'}`}>
                    {quote.status === 'accepted' ? (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    ) : quote.status === 'rejected' ? (
                      <XCircle className="h-3 w-3 text-white" />
                    ) : (
                      <div className="h-2 w-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="text-xs">{quote.status === 'accepted' ? 'Accepted' : quote.status === 'rejected' ? 'Rejected' : 'Response'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                        <ImageModal
                          src={getProductImage(coreItem)}
                          alt={coreItem.product_name}
                          className="w-full h-full"
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
                                     <ImageModal
                                       src={getProductImage(accessory)}
                                       alt={accessory.product_name}
                                       className="w-full h-full rounded"
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
                                 <Wrench className="h-4 w-4 text-brand-teal" />
                                 <span className="text-sm">Professional installation by certified team</span>
                               </div>
                               <span className="text-sm font-medium text-brand-teal">Free</span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                 <Wrench className="h-4 w-4 text-brand-teal" />
                                 <span className="text-sm">Stud Wall Removal</span>
                               </div>
                               <span className="text-sm font-medium text-brand-teal">Free</span>
                            </div>
                          </div>
                        </div>

                        {/* Pricing Summary */}
                        <div className="space-y-2 pt-4 border-t">
                          <div className="flex justify-between">
                            <span>Base Configuration:</span>
                            <span>{formatCurrency(coreItem.total_price)}</span>
                          </div>
                          {relatedAccessories.length > 0 && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>Accessories:</span>
                              <span>+{formatCurrency(relatedAccessories.reduce((sum, acc) => sum + acc.total_price, 0))}</span>
                            </div>
                          )}
                          <Separator />
                          <div className="flex justify-between font-semibold text-lg">
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

      {/* Quote Details */}
      {(quote.room_info || quote.range || quote.finish) && (
        <Card>
          <CardHeader>
            <CardTitle>Quote Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {quote.room_info && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Understairs Width</h4>
                  <p className="font-medium">{quote.room_info}</p>
                </div>
              )}
              {quote.range && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Range</h4>
                  <p className="font-medium">{quote.range}</p>
                </div>
              )}
              {quote.finish && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Finish</h4>
                  <p className="font-medium">{quote.finish}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Log Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-muted-foreground" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Quote Created</p>
                  <p className="text-xs text-muted-foreground">Initial quote generated</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(quote.created_at).toLocaleString()}
              </span>
            </div>
            {quote.status === 'sent' && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Quote Sent</p>
                    <p className="text-xs text-muted-foreground">Delivered to client</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(quote.created_at).toLocaleString()}
                </span>
              </div>
            )}
            {quote.status === 'draft' && (
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center space-x-3">
                  <Edit className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-800">Quote Draft</p>
                    <p className="text-xs text-orange-600">Quote created but not yet sent to client</p>
                  </div>
                </div>
                <span className="text-xs text-orange-600">
                  Ready to send
                </span>
              </div>
            )}
            {quote.status === 'accepted' && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Quote Accepted</p>
                    <p className="text-xs text-green-600">Client accepted the quote</p>
                  </div>
                </div>
                <span className="text-xs text-green-600">
                  Recently
                </span>
              </div>
            )}
            {quote.status === 'rejected' && (
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center space-x-3">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Quote Rejected</p>
                    <p className="text-xs text-red-600">Client declined the quote</p>
                  </div>
                </div>
                <span className="text-xs text-red-600">
                  Recently
                </span>
              </div>
            )}
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
    </div>
  );
};