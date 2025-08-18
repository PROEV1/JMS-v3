import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CalendarDays, User, MapPin, Clock, MoreVertical, Send, Bot, Calendar, X, RotateCcw } from 'lucide-react';
import { Order } from '@/utils/schedulingUtils';
import { OfferStatusBadge } from './OfferStatusBadge';
import { SendOfferModal } from './SendOfferModal';
import { SmartAssignmentModal } from './SmartAssignmentModal';
import { useJobOffers } from '@/hooks/useJobOffers';
import { toast } from 'sonner';

interface Engineer {
  id: string;
  name: string;
  email: string;
  availability?: boolean;
}

interface EnhancedJobCardProps {
  order: Order;
  engineers: Engineer[];
  onUpdate?: () => void;
  showOfferActions?: boolean;
}

export function EnhancedJobCard({ 
  order, 
  engineers, 
  onUpdate, 
  showOfferActions = false 
}: EnhancedJobCardProps) {
  const [showSendOffer, setShowSendOffer] = useState(false);
  const [showSmartAssignment, setShowSmartAssignment] = useState(false);
  
  const { offers, loading, refetch, releaseOffer, resendOffer } = useJobOffers(order.id);
  const activeOffer = offers.find(offer => offer.status === 'pending');
  const latestOffer = offers.length > 0 ? offers[0] : null;

  const handleReleaseOffer = async (offerId: string) => {
    try {
      await releaseOffer(offerId);
      toast.success('Offer slot released');
      onUpdate?.();
    } catch (error: any) {
      toast.error('Failed to release offer');
    }
  };

  const handleResendOffer = async (offerId: string) => {
    try {
      await resendOffer(offerId);
      toast.success('Offer resent successfully');
    } catch (error: any) {
      toast.error('Failed to resend offer');
    }
  };

  const getBucketStatus = () => {
    if (latestOffer) {
      switch (latestOffer.status) {
        case 'pending':
          return 'date_offered';
        case 'accepted':
          return 'date_accepted';
        case 'rejected':
          return 'date_rejected';
        default:
          return order.status_enhanced;
      }
    }
    return order.status_enhanced;
  };

  const getStatusDisplay = () => {
    const bucketStatus = getBucketStatus();
    switch (bucketStatus) {
      case 'awaiting_install_booking':
        return 'Awaiting Installation';
      case 'date_offered':
        return 'Date Offered';
      case 'date_accepted':
        return 'Ready to Book';
      case 'date_rejected':
        return 'Date Rejected';
      default:
        return order.status_enhanced?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              #{order.order_number}
            </CardTitle>
            <div className="flex items-center gap-2">
              {latestOffer && (
                <OfferStatusBadge offer={latestOffer} showTimeRemaining />
              )}
              <Badge variant="outline" className="text-xs">
                {getStatusDisplay()}
              </Badge>
              {showOfferActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowSendOffer(true)}>
                      <Send className="w-4 h-4 mr-2" />
                      Send Offer
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowSmartAssignment(true)}>
                      <Bot className="w-4 h-4 mr-2" />
                      Smart Assign
                    </DropdownMenuItem>
                    {activeOffer && (
                      <>
                        <DropdownMenuItem onClick={() => handleReleaseOffer(activeOffer.id)}>
                          <X className="w-4 h-4 mr-2" />
                          Release Slot
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResendOffer(activeOffer.id)}>
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Resend Offer
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {/* Client Info */}
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{order.client?.full_name}</span>
            </div>

            {/* Location */}
            {(order.job_address || order.postcode) && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  {order.job_address && (
                    <p className="text-muted-foreground">{order.job_address}</p>
                  )}
                  {order.postcode && (
                    <p className="font-medium">{order.postcode}</p>
                  )}
                </div>
              </div>
            )}

            {/* Duration */}
            {order.estimated_duration_hours && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{order.estimated_duration_hours}h estimated</span>
              </div>
            )}

            {/* Engineer Assignment (if any) */}
            {order.engineer_id && order.engineer && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>Assigned: {order.engineer.name}</span>
              </div>
            )}

            {/* Scheduled Date (if any) */}
            {order.scheduled_install_date && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <span>
                  {new Date(order.scheduled_install_date).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
            )}

            {/* Latest Offer Details */}
            {latestOffer && latestOffer.status === 'pending' && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Send className="w-4 h-4 text-muted-foreground" />
                  <span>
                    Offered: {new Date(latestOffer.offered_date).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                {latestOffer.engineer && (
                  <div className="flex items-center gap-2 text-sm mt-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>Engineer: {latestOffer.engineer.name}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <SendOfferModal
        isOpen={showSendOffer}
        onClose={() => setShowSendOffer(false)}
        order={order}
        engineers={engineers}
        onOfferSent={() => {
          refetch();
          onUpdate?.();
        }}
      />

      <SmartAssignmentModal
        isOpen={showSmartAssignment}
        onClose={() => setShowSmartAssignment(false)}
        order={order}
        engineers={engineers.map(e => ({ ...e, availability: e.availability ?? true }))}
        onAssign={async (engineerId, date) => {
          // Handle smart assignment - could automatically send offer
          console.log('Smart assigned:', engineerId, date);
          onUpdate?.();
        }}
      />
    </>
  );
}