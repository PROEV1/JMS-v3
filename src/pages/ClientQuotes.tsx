import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BrandPage, BrandContainer } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { FileText, Eye, CreditCard, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  total_cost: number;
  created_at: string;
  expires_at: string | null;
  is_shareable: boolean;
  share_token: string | null;
  product_details: string;
}

export default function ClientQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingQuoteId, setAcceptingQuoteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (clientError) {
        console.error('Error fetching client:', clientError);
        return;
      }

      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;
      setQuotes(quotesData || []);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast({
        title: "Error",
        description: "Failed to load quotes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptQuote = async (quoteId: string) => {
    try {
      console.log('Starting quote acceptance...', { quoteId });
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session);
      
      if (!session) {
        console.log('No session found, redirecting to auth');
        toast({
          title: "Authentication Required",
          description: "Please log in to accept quotes",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }
      
      setAcceptingQuoteId(quoteId);
      
      // Try direct fetch instead of supabase.functions.invoke
      const functionUrl = `https://qvppvstgconmzzjsryna.supabase.co/functions/v1/client-accept-quote`;
      console.log('Calling function URL:', functionUrl);
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ quoteId })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Function response:', data);

      toast({
        title: "Quote Accepted",
        description: "Redirecting to your order...",
      });

      // Redirect to the order page
      navigate(`/client/orders/${data.orderId}`);
    } catch (error) {
      console.error('Error accepting quote:', error);
      toast({
        title: "Error",
        description: `Failed to accept quote: ${error.message}`,
        variant: "destructive",
      });
      setAcceptingQuoteId(null);
    }
  };

  const handleRejectQuote = async (quoteId: string) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'rejected' })
        .eq('id', quoteId);

      if (error) throw error;

      toast({
        title: "Quote Rejected",
        description: "The quote has been rejected.",
      });

      fetchQuotes();
    } catch (error) {
      console.error('Error rejecting quote:', error);
      toast({
        title: "Error",
        description: "Failed to reject quote",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (loading) {
    return (
      <BrandPage>
        <BrandContainer>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </BrandContainer>
      </BrandPage>
    );
  }

  return (
    <BrandPage>
      <BrandContainer>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/client')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">My Quotes</h1>
            <Badge variant="secondary">{quotes.length}</Badge>
          </div>

          {quotes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No quotes yet</h3>
                <p className="text-muted-foreground">Your quotes will appear here once they're ready.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
        {quotes.map((quote) => (
          <Card 
            key={quote.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/client/quotes/${quote.id}`)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{quote.quote_number}</h3>
                    <Badge className={getStatusColor(quote.status)}>
                      {formatStatus(quote.status)}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Created: {new Date(quote.created_at).toLocaleDateString()}</p>
                    {quote.expires_at && (
                      <p>Expires: {new Date(quote.expires_at).toLocaleDateString()}</p>
                    )}
                    <p className="font-medium text-foreground">{quote.product_details}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">£{quote.total_cost.toLocaleString()}</p>
                  </div>
                  
                  <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/client/quotes/${quote.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    
                    {quote.status === 'sent' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptQuote(quote.id)}
                          disabled={acceptingQuoteId === quote.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {acceptingQuoteId === quote.id ? (
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                              Accepting...
                            </div>
                          ) : (
                            'Accept'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectQuote(quote.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
            </div>
          )}
        </div>
      </BrandContainer>
    </BrandPage>
  );
}