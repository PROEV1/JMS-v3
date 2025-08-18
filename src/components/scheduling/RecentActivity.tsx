import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Calendar, CheckCircle, Clock, User, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

export function RecentActivity() {
  // Fetch recent scheduling activity
  const { data: activities, isLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      // Get recent order activities related to scheduling
      const { data, error } = await supabase
        .from('order_activity')
        .select(`
          *,
          order:orders(
            order_number,
            client:clients(full_name)
          )
        `)
        .in('activity_type', ['assignment', 'status_change', 'scheduling', 'offer_sent', 'offer_accepted'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000 // Refresh every minute
  });

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'assignment':
        return User;
      case 'status_change':
        return Activity;
      case 'scheduling':
        return Calendar;
      case 'offer_sent':
        return Clock;
      case 'offer_accepted':
        return CheckCircle;
      default:
        return Activity;
    }
  };

  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case 'assignment':
        return 'bg-blue-100 text-blue-600';
      case 'status_change':
        return 'bg-purple-100 text-purple-600';
      case 'scheduling':
        return 'bg-green-100 text-green-600';
      case 'offer_sent':
        return 'bg-orange-100 text-orange-600';
      case 'offer_accepted':
        return 'bg-emerald-100 text-emerald-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatActivityDescription = (activity: any) => {
    const orderNumber = activity.order?.order_number;
    const clientName = activity.order?.client?.full_name;
    
    switch (activity.activity_type) {
      case 'assignment':
        return `Engineer assigned to ${orderNumber}`;
      case 'status_change':
        return `Status updated for ${orderNumber}`;
      case 'scheduling':
        return `Date scheduled for ${orderNumber}`;
      case 'offer_sent':
        return `Offer sent for ${orderNumber}`;
      case 'offer_accepted':
        return `Offer accepted for ${orderNumber}`;
      default:
        return activity.description;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : activities && activities.length > 0 ? (
          activities.map((activity, index) => {
            const Icon = getActivityIcon(activity.activity_type);
            const iconColor = getActivityColor(activity.activity_type);
            
            return (
              <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                <div className={`p-1.5 rounded-lg ${iconColor}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {formatActivityDescription(activity)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activity.order?.client?.full_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-6">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}