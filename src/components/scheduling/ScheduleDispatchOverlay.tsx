import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, AlertTriangle, CheckCircle } from 'lucide-react';

interface DispatchStatus {
  status?: string;
  urgencyLevel?: 'normal' | 'warning' | 'urgent' | 'success';
  daysUntilInstall?: number;
}

interface ScheduleDispatchOverlayProps {
  orderId: string;
  dispatchStatus?: DispatchStatus;
  className?: string;
}

export function ScheduleDispatchOverlay({ 
  orderId, 
  dispatchStatus, 
  className = '' 
}: ScheduleDispatchOverlayProps) {
  if (!dispatchStatus) {
    return null;
  }

  const getDispatchIcon = () => {
    switch (dispatchStatus.status) {
      case 'dispatched':
        return <Truck className="h-3 w-3 text-green-500" />;
      case 'delivered':
        return <CheckCircle className="h-3 w-3 text-blue-500" />;
      case 'issue':
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case 'pending_dispatch':
        if (dispatchStatus.urgencyLevel === 'urgent') {
          return <AlertTriangle className="h-3 w-3 text-red-500" />;
        }
        return <Package className="h-3 w-3 text-orange-500" />;
      default:
        return <Package className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getDispatchBadge = () => {
    const baseClasses = "text-xs px-1 py-0.5";
    
    switch (dispatchStatus.status) {
      case 'dispatched':
        return (
          <Badge variant="default" className={`${baseClasses} bg-green-500 text-white`}>
            Sent
          </Badge>
        );
      case 'delivered':
        return (
          <Badge variant="default" className={`${baseClasses} bg-blue-500 text-white`}>
            Delivered
          </Badge>
        );
      case 'issue':
        return (
          <Badge variant="destructive" className={baseClasses}>
            Issue
          </Badge>
        );
      case 'pending_dispatch':
        if (dispatchStatus.urgencyLevel === 'urgent') {
          return (
            <Badge variant="destructive" className={baseClasses}>
              Urgent
            </Badge>
          );
        } else if (dispatchStatus.urgencyLevel === 'warning') {
          return (
            <Badge variant="destructive" className={`${baseClasses} bg-orange-500`}>
              Due
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className={baseClasses}>
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`absolute top-1 right-1 flex items-center gap-1 ${className}`}>
      {getDispatchIcon()}
      {getDispatchBadge()}
    </div>
  );
}

// Hook to get dispatch status for an order
export function useDispatchStatus(orderId: string) {
  // This would integrate with the dispatch data fetching
  // For now, returning a placeholder - in real implementation would query dispatch status
  return {
    status: 'pending_dispatch',
    urgencyLevel: 'normal' as const,
    daysUntilInstall: 5
  };
}