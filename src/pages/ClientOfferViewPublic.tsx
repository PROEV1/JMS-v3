import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, User, CheckCircle, XCircle, AlertTriangle, Calendar, RefreshCw } from 'lucide-react';
import { BrandTypography } from '@/components/brand/BrandTypography';
import { useToast } from '@/hooks/use-toast';
import { ProEVLogo } from '@/components/ProEVLogo';
import { apiClient, buildFunctionUrl } from '@/lib/apiClient';

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

export default function ClientOfferViewPublic() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [blockThisDate, setBlockThisDate] = useState(true);
  const [blockDateRange, setBlockDateRange] = useState(false);
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);

  useEffect(() => {
    const fetchOffer = async () => {
      if (!token) return;

      console.log('Fetching offer with token:', token);

      try {
        // Use apiClient with timeout instead of direct supabase invoke
        const url = buildFunctionUrl('offer-lookup');
        const response = await apiClient.post(url, { token }, { 
          timeoutMs: 10000, // 10 second timeout
          retries: 2
        } as any);

        console.log('Offer lookup response:', response);

        if (!response.ok || response.error) {
          setError(response.error || 'Failed to load offer details');
          if (response.expired) {
            setError('This offer has expired');
          }
        } else if (response.data) {
          setOffer(response.data);
          console.log('Offer loaded successfully:', response.data);
        } else {
          setError('Invalid offer data received');
        }
      } catch (err: any) {
        console.error('Error fetching offer:', err);
        
        // Provide user-friendly error messages
        if (err.code === 'CircuitOpen') {
          setError('Service temporarily unavailable. Please try again in a moment.');
        } else if (err.status === 0 || err.code === 'AbortError') {
          setError('Request timed out. Please check your connection and try again.');
        } else if (err.status === 404) {
          setError('This offer could not be found or has expired.');
        } else {
          setError('Failed to load offer details. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOffer();
  }, [token, retryAttempts]);

  const handleAccept = async () => {
    if (!token) return;
    
    setResponding(true);
    try {
      console.log('Accepting offer with token:', token);
      
      const url = buildFunctionUrl('offer-respond');
      const response = await apiClient.post(url, {
        token,
        response: 'accept'
      }, { timeoutMs: 15000 } as any);

      console.log('Accept response:', response);

      if (!response.ok || response.error) {
        throw new Error(response.error || 'Failed to accept offer');
      }

      toast({
        title: "Success",
        description: 'Offer accepted successfully!',
      });
      
      // Update the offer state to show success
      if (offer) {
        setOffer({
          ...offer,
          status: 'accepted',
          already_responded: true
        });
      }

    } catch (err: any) {
      console.error('Error accepting offer:', err);
      toast({
        title: "Error",
        description: err.message || 'Failed to accept offer',
        variant: "destructive",
      });
    } finally {
      setResponding(false);
    }
  };

  const handleReject = async () => {
    if (!token || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: 'Please provide a reason for rejection',
        variant: "destructive",
      });
      return;
    }

    // Validate date range if blocking a range
    if (blockDateRange && (!blockStartDate || !blockEndDate)) {
      toast({
        title: "Error",
        description: 'Please provide both start and end dates for the date range',
        variant: "destructive",
      });
      return;
    }

    if (blockDateRange && blockStartDate && blockEndDate && new Date(blockStartDate) > new Date(blockEndDate)) {
      toast({
        title: "Error",
        description: 'Start date cannot be after end date',
        variant: "destructive",
      });
      return;
    }
    
    setResponding(true);
    try {
      const requestBody: any = {
        token,
        response: 'reject',
        rejection_reason: rejectionReason,
        block_this_date: blockThisDate
      };

      if (blockDateRange && blockStartDate && blockEndDate) {
        requestBody.block_date_range = {
          start_date: blockStartDate,
          end_date: blockEndDate
        };
      }

      const url = buildFunctionUrl('offer-respond');
      const response = await apiClient.post(url, requestBody, { timeoutMs: 15000 } as any);

      if (!response.ok || response.error) {
        throw new Error(response.error || 'Failed to reject offer');
      }

      toast({
        title: "Success",
        description: 'Offer rejected',
      });
      
      // Update the offer state to show rejection
      if (offer) {
        setOffer({
          ...offer,
          status: 'rejected',
          already_responded: true
        });
      }

    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || 'Failed to reject offer',
        variant: "destructive",
      });
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
      <div className="min-h-screen bg-background">
        <header className="h-16 flex items-center border-b bg-white shadow-sm px-4">
          <ProEVLogo size="md" />
        </header>
        <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading offer details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-16 flex items-center border-b bg-white shadow-sm px-4">
          <ProEVLogo size="md" />
        </header>
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
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    setRetryAttempts(prev => prev + 1);
                  }}
                  disabled={retryAttempts >= 3}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {retryAttempts >= 3 ? 'Max retries reached' : 'Try Again'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = 'mailto:support@proev.co.uk'}
                >
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const offerDate = new Date(offer.offered_date);
  const expiresAt = new Date(offer.expires_at);
  const isExpired = new Date() > expiresAt;

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 flex items-center border-b bg-white shadow-sm px-4">
        <ProEVLogo size="md" />
      </header>
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

                    {/* Date blocking options */}
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="block-this-date"
                          checked={blockThisDate}
                          onCheckedChange={(checked) => setBlockThisDate(checked as boolean)}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label htmlFor="block-this-date" className="text-sm font-medium">
                            Don't offer this date again
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            We won't suggest {offer ? new Date(offer.offered_date).toLocaleDateString('en-GB') : 'this date'} for future installations
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="block-date-range"
                          checked={blockDateRange}
                          onCheckedChange={(checked) => setBlockDateRange(checked as boolean)}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label htmlFor="block-date-range" className="text-sm font-medium">
                            Block a date range
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Block multiple dates when you're away or unavailable
                          </p>
                        </div>
                      </div>

                      {blockDateRange && (
                        <div className="grid grid-cols-2 gap-3 ml-6">
                          <div>
                            <Label htmlFor="start-date" className="text-xs">From</Label>
                            <Input
                              id="start-date"
                              type="date"
                              value={blockStartDate}
                              onChange={(e) => setBlockStartDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="end-date" className="text-xs">To</Label>
                            <Input
                              id="end-date"
                              type="date"
                              value={blockEndDate}
                              onChange={(e) => setBlockEndDate(e.target.value)}
                              min={blockStartDate || new Date().toISOString().split('T')[0]}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
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
                          setBlockThisDate(true);
                          setBlockDateRange(false);
                          setBlockStartDate('');
                          setBlockEndDate('');
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
                <p className="text-muted-foreground mb-4">
                  {getStatusText()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Thank you for your response. If you have any questions, please contact our team at{' '}
                  <a href="mailto:support@proev.co.uk" className="text-primary hover:underline">
                    support@proev.co.uk
                  </a>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Contact Information */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>
              Need help? Contact our team at{' '}
              <a href="mailto:support@proev.co.uk" className="text-primary hover:underline">
                support@proev.co.uk
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}