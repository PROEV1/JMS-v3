import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  XCircle, 
  Bell,
  X,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  actionLabel?: string;
  actionUrl?: string;
  onAction?: () => void;
  isDismissible?: boolean;
  priority?: 'low' | 'medium' | 'high';
  category?: 'stock' | 'system' | 'order' | 'general';
}

interface NotificationBannerProps {
  notifications: Notification[];
  onDismiss?: (id: string) => void;
  onAction?: (notification: Notification) => void;
  maxDisplay?: number;
  className?: string;
}

const notificationIcons = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle
};

const notificationColors = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-orange-200 bg-orange-50 text-orange-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  success: 'border-green-200 bg-green-50 text-green-900'
};

export function NotificationBanner({
  notifications,
  onDismiss,
  onAction,
  maxDisplay = 3,
  className = ''
}: NotificationBannerProps) {
  if (notifications.length === 0) {
    return null;
  }

  const displayNotifications = notifications
    .sort((a, b) => {
      // Sort by priority first, then by timestamp
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityWeight[a.priority || 'medium'];
      const bPriority = priorityWeight[b.priority || 'medium'];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return b.timestamp.getTime() - a.timestamp.getTime();
    })
    .slice(0, maxDisplay);

  const remainingCount = notifications.length - displayNotifications.length;

  return (
    <div className={`space-y-3 ${className}`}>
      {displayNotifications.map((notification) => {
        const Icon = notificationIcons[notification.type];
        
        return (
          <Alert
            key={notification.id}
            className={`${notificationColors[notification.type]} border-l-4`}
          >
            <div className="flex items-start gap-3">
              <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
              
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{notification.title}</h4>
                      {notification.priority === 'high' && (
                        <Badge variant="destructive" className="text-xs h-5">
                          High Priority
                        </Badge>
                      )}
                      {notification.category && (
                        <Badge variant="outline" className="text-xs h-5">
                          {notification.category}
                        </Badge>
                      )}
                    </div>
                    <AlertDescription className="text-sm mt-1">
                      {notification.message}
                    </AlertDescription>
                  </div>
                  
                  {notification.isDismissible && onDismiss && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDismiss(notification.id)}
                      className="h-6 w-6 p-0 hover:bg-black/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(notification.timestamp)}
                  </span>
                  
                  {(notification.actionLabel || notification.onAction) && (
                    <div className="flex gap-2">
                      {notification.actionUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => window.open(notification.actionUrl, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {notification.actionLabel || 'View'}
                        </Button>
                      )}
                      {notification.onAction && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            notification.onAction?.();
                            onAction?.(notification);
                          }}
                        >
                          {notification.actionLabel || 'Action'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Alert>
        );
      })}
      
      {remainingCount > 0 && (
        <div className="text-center">
          <Button variant="outline" size="sm" className="text-xs">
            <Bell className="h-3 w-3 mr-1" />
            View {remainingCount} more notifications
          </Button>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return timestamp.toLocaleDateString();
}

// Example usage and notification generators
export const createStockNotification = (itemName: string, currentLevel: number, reorderPoint: number): Notification => ({
  id: `stock-${Date.now()}`,
  type: 'warning',
  title: 'Low Stock Alert',
  message: `${itemName} is running low (${currentLevel} remaining, reorder at ${reorderPoint})`,
  timestamp: new Date(),
  priority: 'high',
  category: 'stock',
  actionLabel: 'Create PO',
  isDismissible: true
});

export const createSystemNotification = (message: string): Notification => ({
  id: `system-${Date.now()}`,
  type: 'info',
  title: 'System Update',
  message,
  timestamp: new Date(),
  priority: 'medium',
  category: 'system',
  isDismissible: true
});