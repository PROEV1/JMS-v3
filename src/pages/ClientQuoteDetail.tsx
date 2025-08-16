import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ArrowLeft, Download, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrandCard } from '@/components/brand/BrandCard';

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
        toast.error('Failed to load client data');
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
        toast.error('Quote not found');
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
        toast.error('Failed to load quote items');
        return;
      }

      setQuote(quoteData);
      setQuoteItems(itemsData || []);
    } catch (error) {
      console.error('Error in fetchQuoteDetails:', error);
      toast.error('Failed to load quote details');
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
        toast.error('Please log in to accept quotes');
        navigate('/auth');
        return;
      }
      
      setAccepting(true);
      
      const { data, error } = await supabase.functions.invoke('client-accept-quote', {
        body: { quoteId: quote.id }
      });

      console.log('Function response:', { data, error });

      if (error) throw error;

      toast.success('Quote accepted! Redirecting to your order...');
      
      // Redirect to the order page
      navigate(`/client/orders/${data.orderId}`);
    } catch (error) {
      console.error('Error accepting quote:', error);
      toast.error('Failed to accept quote. Please try logging in again.');
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

      toast.success('Quote rejected');
      setQuote({ ...quote, status: 'rejected' });
    } catch (error) {
      console.error('Error rejecting quote:', error);
      toast.error('Failed to reject quote');
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
    <div className="container mx-auto p-6">
      <div className="space-y-6">
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

        <Card className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold">{quote.quote_number}</h1>
              <p className="text-muted-foreground">
                Created {new Date(quote.created_at).toLocaleDateString()}
              </p>
              {quote.expires_at && (
                <p className="text-sm text-muted-foreground">
                  Expires {new Date(quote.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <Badge className={getStatusColor(quote.status)}>
              {formatStatus(quote.status)}
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Product Details</h3>
              <p className="text-sm text-muted-foreground">{quote.product_details}</p>
              
              {quote.notes && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">{quote.notes}</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Quote Items</h3>
              <div className="space-y-2">
                {quoteItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-2 bg-muted rounded">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">£{item.total_price.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-lg font-bold">£{quote.total_cost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {quote.status === 'sent' && (
            <div className="flex gap-4 mt-6 pt-6 border-t">
              <Button
                onClick={handleAcceptQuote}
                disabled={accepting}
                className="flex-1"
              >
                {accepting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Accept Quote
              </Button>
              <Button
                onClick={handleRejectQuote}
                disabled={rejecting}
                variant="outline"
                className="flex-1"
              >
                {rejecting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Reject Quote
              </Button>
            </div>
          )}

          {quote.is_shareable && quote.share_token && (
            <div className="mt-6 pt-6 border-t">
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}