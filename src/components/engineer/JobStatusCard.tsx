import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Package, Phone, Play, Navigation, CheckCircle, Upload } from 'lucide-react';
import { formatTimeSlot, formatDateOnly } from '@/utils/dateUtils';
import { OrderStatusEnhanced } from '@/components/admin/EnhancedJobStatusBadge';

interface JobStatusCardProps {
  job: {
    id: string;
    order_number: string;
    client_name: string;
    client_phone: string;
    job_address: string;
    scheduled_install_date: string | null;
    status_enhanced: OrderStatusEnhanced;
    engineer_status: string | null;
    product_details: string;
    engineer_signed_off_at: string | null;
    upload_count?: number;
  };
  onActionClick: (jobId: string, action: 'start' | 'continue' | 'upload' | 'view') => void;
}

const getStatusConfig = (status: OrderStatusEnhanced, engineerStatus: string | null, signedOff: boolean, hasUploads: boolean) => {
  // Priority: Check if completed but missing uploads
  if (signedOff && !hasUploads) {
    return {
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: Upload,
      label: 'Awaiting Upload',
      action: 'upload' as const,
      actionLabel: 'Upload Images',
      actionVariant: 'destructive' as const
    };
  }

  // Then check engineer status progression
  switch (engineerStatus) {
    case 'completed':
      return {
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: CheckCircle,
        label: 'Completed',
        action: 'view' as const,
        actionLabel: 'View Details',
        actionVariant: 'outline' as const
      };
    case 'in_progress':
      return {
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: Play,
        label: 'In Progress',
        action: 'continue' as const,
        actionLabel: 'Continue Job',
        actionVariant: 'default' as const
      };
    case 'on_way':
      return {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: Navigation,
        label: 'On Way',
        action: 'continue' as const,
        actionLabel: 'Continue Job',
        actionVariant: 'default' as const
      };
    case 'scheduled':
    default:
      return {
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: Clock,
        label: 'Scheduled',
        action: 'start' as const,
        actionLabel: 'Start Job',
        actionVariant: 'default' as const
      };
  }
};

export function JobStatusCard({ job, onActionClick }: JobStatusCardProps) {
  const statusConfig = getStatusConfig(
    job.status_enhanced,
    job.engineer_status,
    !!job.engineer_signed_off_at,
    (job.upload_count || 0) > 0
  );

  const StatusIcon = statusConfig.icon;

  return (
    <Card className={`border-l-4 ${statusConfig.color.replace('bg-', 'border-l-').replace('-100', '-500')}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <Badge className={statusConfig.color} variant="secondary">
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
            <span className="text-sm font-mono text-muted-foreground">
              {job.order_number}
            </span>
          </div>
          <Button
            size="sm"
            variant={statusConfig.actionVariant}
            onClick={() => onActionClick(job.id, statusConfig.action)}
          >
            {statusConfig.actionLabel}
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{job.client_name}</h3>
          
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{job.job_address}</span>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {job.scheduled_install_date ? (
                <span>{formatDateOnly(job.scheduled_install_date)}</span>
              ) : (
                <span className="text-muted-foreground">Date TBC</span>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              <span>{job.client_phone}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4" />
            <span className="text-muted-foreground line-clamp-1">
              {job.product_details}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}