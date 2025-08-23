import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, XCircle, Upload, Eye } from 'lucide-react';

interface SurveyStatusBadgeProps {
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rework_requested' | 'resubmitted';
  compact?: boolean;
}

export function SurveyStatusBadge({ status, compact = false }: SurveyStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'draft':
        return {
          variant: 'secondary' as const,
          icon: Clock,
          label: compact ? 'Draft' : 'Survey Draft',
          className: 'bg-slate-100 text-slate-700 border-slate-200'
        };
      case 'submitted':
        return {
          variant: 'default' as const,
          icon: Upload,
          label: compact ? 'Submitted' : 'Survey Submitted',
          className: 'bg-blue-100 text-blue-700 border-blue-200'
        };
      case 'under_review':
        return {
          variant: 'default' as const,
          icon: Eye,
          label: compact ? 'Review' : 'Under Review',
          className: 'bg-amber-100 text-amber-700 border-amber-200'
        };
      case 'approved':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          label: compact ? 'Approved' : 'Survey Approved',
          className: 'bg-green-100 text-green-700 border-green-200'
        };
      case 'rework_requested':
        return {
          variant: 'destructive' as const,
          icon: AlertTriangle,
          label: compact ? 'Rework' : 'Rework Requested',
          className: 'bg-red-100 text-red-700 border-red-200'
        };
      case 'resubmitted':
        return {
          variant: 'default' as const,
          icon: Upload,
          label: compact ? 'Resubmitted' : 'Survey Resubmitted',
          className: 'bg-purple-100 text-purple-700 border-purple-200'
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: Clock,
          label: 'Unknown',
          className: 'bg-slate-100 text-slate-700 border-slate-200'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}