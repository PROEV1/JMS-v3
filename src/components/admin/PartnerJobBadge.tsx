import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Building2, MapPin } from 'lucide-react';

interface PartnerJobBadgeProps {
  isPartnerJob?: boolean;
  partnerName?: string;
  subPartner?: string;
  partnerStatus?: string;
  partnerUrl?: string;
}

export const PartnerJobBadge = ({ 
  isPartnerJob = false, 
  partnerName, 
  subPartner, 
  partnerStatus,
  partnerUrl 
}: PartnerJobBadgeProps) => {
  if (!isPartnerJob) return null;

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      case 'completed':
        return 'default'; // Changed from 'success' to 'default'
      case 'on_hold':
        return 'secondary'; // Changed from 'warning' to 'secondary'
      default:
        return 'outline';
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Partner Badge */}
      <Badge variant="outline" className="flex items-center gap-1">
        <Building2 className="w-3 h-3" />
        {partnerName || 'Partner Job'}
      </Badge>

      {/* Sub-partner Badge */}
      {subPartner && (
        <Badge variant="secondary" className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {subPartner}
        </Badge>
      )}

      {/* Partner Status Badge */}
      {partnerStatus && (
        <Badge variant={getStatusColor(partnerStatus)}>
          {partnerStatus.replace('_', ' ').toUpperCase()}
        </Badge>
      )}

      {/* Open in Partner Button */}
      {partnerUrl && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => window.open(partnerUrl, '_blank')}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Open in Partner
        </Button>
      )}
    </div>
  );
};