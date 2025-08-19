import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OfferLinkWidgetProps {
  orderId: string;
}

interface JobOffer {
  id: string;
  client_token: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  offered_date: string;
  expires_at: string;
  engineer: {
    name: string;
  };
}

export function OfferLinkWidget({ orderId }: OfferLinkWidgetProps) {
  const [activeOffer, setActiveOffer] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveOffer();
  }, [orderId]);

  const fetchActiveOffer = async () => {
    try {
      const { data, error } = await supabase
        .from('job_offers')
        .select(`
          id,
          client_token,
          status,
          offered_date,
          expires_at,
          engineer:engineers!job_offers_engineer_id_fkey(name)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setActiveOffer(data);
    } catch (error) {
      console.error('Error fetching active offer:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyOfferUrl = () => {
    if (activeOffer) {
      const offerUrl = `${window.location.origin}/offers/${activeOffer.client_token}`;
      navigator.clipboard.writeText(offerUrl);
      toast.success('Offer URL copied to clipboard');
    }
  };

  const openOfferUrl = () => {
    if (activeOffer) {
      const offerUrl = `${window.location.origin}/offers/${activeOffer.client_token}`;
      window.open(offerUrl, '_blank');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'expired':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Awaiting Response';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-muted h-10 w-10"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activeOffer) {
    return null;
  }

  const isExpired = new Date() > new Date(activeOffer.expires_at);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          Client Offer Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {getStatusIcon(activeOffer.status)}
              <Badge variant={
                activeOffer.status === 'pending' ? 'default' :
                activeOffer.status === 'accepted' ? 'default' :
                activeOffer.status === 'rejected' ? 'destructive' : 'secondary'
              }>
                {getStatusLabel(activeOffer.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Offered to {activeOffer.engineer.name} for {new Date(activeOffer.offered_date).toLocaleDateString()}
            </p>
            {activeOffer.status === 'pending' && !isExpired && (
              <p className="text-xs text-warning">
                Expires: {new Date(activeOffer.expires_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyOfferUrl}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Link
          </Button>
          <Button variant="outline" size="sm" onClick={openOfferUrl}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Link
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Share this link with the client to let them accept or reject the installation date.
        </p>
      </CardContent>
    </Card>
  );
}