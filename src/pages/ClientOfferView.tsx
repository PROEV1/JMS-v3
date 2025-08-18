import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, User, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import Layout from '@/components/Layout';
import { BrandTypography } from '@/components/brand/BrandTypography';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OfferDetails {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  offered_date: string;
  time_window?: string;
  expires_at: string;
  order: {
    order_number: string;
    client: {
      full_name: string;
      email: string;
    };
    is_partner_job: boolean;
  };
  engineer: {
    name: string;
  };
  already_responded?: boolean;
  expired?: boolean;
}

export default function ClientOfferView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOffer = async () => {
      if (!token) return;

      try {
        const { data, error } = await supabase.functions.invoke('offer-lookup', {
          body: { token }
        });

        if (error || data.error) {
          setError(data?.error || 'Failed to load offer details');
          if (data?.expired) {
            setError('This offer has expired');
          }
        } else {
          setOffer(data);
        }
      } catch (err: any) {
        setError('Failed to load offer details');
        console.error('Error fetching offer:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOffer();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    
    setResponding(true);
    try {
      const { data, error } = await supabase.functions.invoke('offer-respond', {
        body: {
          token,
          response: 'accept'
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to accept offer');
      }

      toast.success('Offer accepted successfully!');
      
      // Update the offer state to show success
      if (offer) {
        setOffer({
          ...offer,
          status: 'accepted',
          already_responded: true
        });
      }

    } catch (err: any) {
      toast.error(err.message || 'Failed to accept offer');
      console.error('Error accepting offer:', err);
    } finally {
      setResponding(false);
    }
  };

  const handleReject = async () => {
    if (!token || !rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    
    setResponding(true);
    try {
      const { data, error } = await supabase.functions.invoke('offer-respond', {
        body: {
          token,
          response: 'reject',
          rejection_reason: rejectionReason
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to reject offer');
      }

      toast.success('Offer rejected');
      
      // Update the offer state to show rejection
      if (offer) {
        setOffer({
          ...offer,
          status: 'rejected',
          already_responded: true
        });
      }

    } catch (err: any) {
      toast.error(err.message || 'Failed to reject offer');
      console.error('Error rejecting offer:', err);
    } finally {
      setResponding(false);
    }
  };

  const getStatusIcon = () => {
    if (!offer) return null;
    
    switch (offer.status) {
      case 'accepted':
        return <CheckCircle className="w-6 h-6 text-success" />;
      case 'rejected':
        return <XCircle className="w-6 h-6 text-destructive" />;
      case 'expired':
        return <AlertTriangle className="w-6 h-6 text-warning" />;
      default:
        return <Clock className="w-6 h-6 text-primary" />;
    }
  };

  const getStatusText = () => {
    if (!offer) return '';
    
    switch (offer.status) {
      case 'accepted':
        return 'This installation slot has been accepted. We will contact you shortly with further details.';
      case 'rejected':
        return 'This installation slot has been rejected. Our team will be in touch with alternative dates.';
      case 'expired':
        return 'This offer has expired. Please contact us for new available dates.';
      default:
        return 'Please review the installation slot details below and choose your response.';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading offer details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !offer) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <CardTitle>Offer Not Available</CardTitle>
              <CardDescription>
                {error || 'This offer could not be found or has expired.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                If you believe this is an error, please contact our support team.
              </p>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = 'mailto:support@proev.co.uk'}
              >
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const offerDate = new Date(offer.offered_date);
  const expiresAt = new Date(offer.expires_at);
  const isExpired = new Date() > expiresAt;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <BrandTypography variant="heading1" className="mb-2">
              Installation Slot Offer
            </BrandTypography>
            <p className="text-muted-foreground">
              {getStatusText()}
            </p>
          </div>

          {/* Offer Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Installation Details
              </CardTitle>
              <CardDescription>
                Order #{offer.order.order_number} for {offer.order.client.full_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Proposed Date</label>
                  <p className="font-semibold">
                    {offerDate.toLocaleDateString('en-GB', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Time Window</label>
                  <p className="font-semibold">
                    {offer.time_window || 'To be confirmed'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Engineer</label>
                  <p className="font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {offer.engineer.name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Offer Status</label>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      offer.status === 'pending' ? 'default' :
                      offer.status === 'accepted' ? 'default' :
                      offer.status === 'rejected' ? 'destructive' : 'secondary'
                    }>
                      {offer.status === 'pending' ? 'Awaiting Response' :
                       offer.status === 'accepted' ? 'Accepted' :
                       offer.status === 'rejected' ? 'Rejected' : 'Expired'}
                    </Badge>
                  </div>
                </div>
              </div>

              {offer.status === 'pending' && !isExpired && (
                <Alert>
                  <Clock className="w-4 h-4" />
                  <AlertDescription>
                    This offer expires on {expiresAt.toLocaleString('en-GB')}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {offer.status === 'pending' && !isExpired && !offer.already_responded && (
            <Card>
              <CardHeader>
                <CardTitle>Your Response</CardTitle>
                <CardDescription>
                  Please choose whether you would like to accept or reject this installation slot.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!showRejectionForm ? (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                      onClick={handleAccept}
                      disabled={responding}
                      className="flex-1"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {responding ? 'Accepting...' : 'Accept Offer'}
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => setShowRejectionForm(true)}
                      disabled={responding}
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject Offer
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Reason for rejection (required)
                      </label>
                      <Textarea
                        placeholder="Please let us know why this date doesn't work for you..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="mt-2"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-4">
                      <Button 
                        variant="destructive"
                        onClick={handleReject}
                        disabled={responding || !rejectionReason.trim()}
                        className="flex-1"
                      >
                        {responding ? 'Rejecting...' : 'Confirm Rejection'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowRejectionForm(false);
                          setRejectionReason('');
                        }}
                        disabled={responding}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Success/Status Messages */}
          {(offer.already_responded || offer.status !== 'pending') && (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="flex justify-center mb-4">
                  {getStatusIcon()}
                </div>
                <BrandTypography variant="heading3" className="mb-2">
                  {offer.status === 'accepted' ? 'Thank You!' :
                   offer.status === 'rejected' ? 'Response Received' :
                   'Offer Expired'}
                </BrandTypography>
                <p className="text-muted-foreground mb-4">
                  {getStatusText()}
                </p>
                <p className="text-sm text-muted-foreground">
                  If you have any questions, please contact us at{' '}
                  <a href="mailto:support@proev.co.uk" className="text-primary hover:underline">
                    support@proev.co.uk
                  </a>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}