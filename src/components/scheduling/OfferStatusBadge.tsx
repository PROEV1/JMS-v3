import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { JobOffer } from '@/hooks/useJobOffers';

interface OfferStatusBadgeProps {
  offer: JobOffer;
  showTimeRemaining?: boolean;
}

export function OfferStatusBadge({ offer, showTimeRemaining = false }: OfferStatusBadgeProps) {
  const getStatusVariant = () => {
    switch (offer.status) {
      case 'pending':
        return 'default';
      case 'accepted':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'expired':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = () => {
    switch (offer.status) {
      case 'pending':
        return <Clock className="w-3 h-3 mr-1" />;
      case 'accepted':
        return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'rejected':
        return <XCircle className="w-3 h-3 mr-1" />;
      case 'expired':
        return <AlertTriangle className="w-3 h-3 mr-1" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (offer.status) {
      case 'pending':
        return 'Offer Sent';
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      case 'expired':
        return 'Expired';
      default:
        return offer.status;
    }
  };

  const getTimeRemaining = () => {
    if (offer.status !== 'pending') return null;
    
    const now = new Date();
    const expires = new Date(offer.expires_at);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={getStatusVariant()} className="flex items-center">
        {getStatusIcon()}
        {getStatusText()}
      </Badge>
      {showTimeRemaining && offer.status === 'pending' && (
        <span className="text-xs text-muted-foreground">
          {getTimeRemaining()}
        </span>
      )}
    </div>
  );
}