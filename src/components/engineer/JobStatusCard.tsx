import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Package, Phone, Play, Navigation, CheckCircle, Upload, Zap } from 'lucide-react';
import { formatTimeSlot, formatDateOnly } from '@/utils/dateUtils';
import { OrderStatusEnhanced } from '@/components/admin/EnhancedJobStatusBadge';

interface ChargerInfo {
  id: string;
  serial_number: string;
  status: string;
  charger_model?: string;
}

interface JobStatusCardProps {
  job: {
    id: string;
    order_number: string;
    client_name: string;
    client_phone: string;
    job_address: string;
    scheduled_install_date: string | null;
    status_enhanced: OrderStatusEnhanced;
    product_details: string;
    engineer_signed_off_at: string | null;
    upload_count?: number;
    job_type?: 'installation' | 'assessment' | 'service_call';
    assigned_chargers?: ChargerInfo[];
  };
  onActionClick: (jobId: string, action: 'start' | 'continue' | 'upload' | 'view') => void;
}

const getStatusConfig = (status: OrderStatusEnhanced, signedOff: boolean, hasUploads: boolean) => {
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

  // Check if signed off (completed)
  if (signedOff) {
    return {
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: CheckCircle,
      label: 'Completed',
      action: 'view' as const,
      actionLabel: 'View Details',
      actionVariant: 'outline' as const
    };
  }

  // Default to scheduled status
  return {
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Clock,
    label: 'Scheduled',
    action: 'start' as const,
    actionLabel: 'Start Job',
    actionVariant: 'default' as const
  };
};

export function JobStatusCard({ job, onActionClick }: JobStatusCardProps) {
  const statusConfig = getStatusConfig(
    job.status_enhanced,
    !!job.engineer_signed_off_at,
    (job.upload_count || 0) > 0
  );

  const StatusIcon = statusConfig.icon;

  return (
    <Card className={`border-l-4 ${statusConfig.color.replace('bg-', 'border-l-').replace('-100', '-500')}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={statusConfig.color} variant="secondary">
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
            {job.job_type && (
              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                {job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1).replace('_', ' ')}
              </Badge>
            )}
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

          {/* Assigned Chargers */}
          {job.assigned_chargers && job.assigned_chargers.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-blue-600" />
              <div className="flex gap-1 flex-wrap">
                {job.assigned_chargers.map((charger) => (
                  <Badge key={charger.id} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    <Zap className="h-3 w-3 mr-1" />
                    {charger.serial_number}
                    {charger.charger_model && ` (${charger.charger_model})`}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}