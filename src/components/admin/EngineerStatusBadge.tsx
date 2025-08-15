import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Navigation, Play, CheckCircle } from 'lucide-react';

export type EngineerStatus = 'scheduled' | 'on_way' | 'in_progress' | 'completed';

interface EngineerStatusBadgeProps {
  status: EngineerStatus | string | null;
  className?: string;
  showIcon?: boolean;
}

const statusConfig = {
  scheduled: {
    label: 'Scheduled',
    icon: Clock,
    color: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  },
  on_way: {
    label: 'On Way',
    icon: Navigation,
    color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  },
  in_progress: {
    label: 'Started',
    icon: Play,
    color: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
  },
  completed: {
    label: 'Complete',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 hover:bg-green-200',
  },
};

export function EngineerStatusBadge({ status, className, showIcon = true }: EngineerStatusBadgeProps) {
  if (!status) {
    return null;
  }

  const normalizedStatus = status.toLowerCase() as EngineerStatus;
  const config = statusConfig[normalizedStatus];

  if (!config) {
    return (
      <Badge variant="secondary" className={className}>
        {status}
      </Badge>
    );
  }

  const IconComponent = config.icon;

  return (
    <Badge 
      variant="secondary" 
      className={`${config.color} ${className || ''}`}
    >
      {showIcon && <IconComponent className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}