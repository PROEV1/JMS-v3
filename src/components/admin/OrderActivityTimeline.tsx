import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { 
  Clock, 
  User, 
  CreditCard, 
  FileText, 
  Calendar, 
  Settings, 
  CheckCircle,
  AlertTriangle
} from "lucide-react";

interface ActivityItem {
  id: string;
  activity_type: string;
  description: string;
  details: any;
  created_at: string;
  created_by: string | null;
  user_email?: string;
}

interface OrderActivityTimelineProps {
  orderId: string;
}

const activityIcons = {
  status_change: Settings,
  engineer_assignment: User,
  install_booking: Calendar,
  agreement_signed: FileText,
  payment_update: CreditCard,
  default: CheckCircle,
};

const activityColors = {
  status_change: "bg-blue-100 text-blue-800",
  engineer_assignment: "bg-purple-100 text-purple-800",
  install_booking: "bg-green-100 text-green-800",
  agreement_signed: "bg-emerald-100 text-emerald-800",
  payment_update: "bg-amber-100 text-amber-800",
  default: "bg-gray-100 text-gray-800",
};

export function OrderActivityTimeline({ orderId }: OrderActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [orderId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('order_activity')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get user emails for activities that have created_by
      const userIds = data?.map(a => a.created_by).filter(Boolean) || [];
      let userEmails: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds);
        
        userEmails = profiles?.reduce((acc, profile) => {
          acc[profile.user_id] = profile.email;
          return acc;
        }, {} as Record<string, string>) || {};
      }

      const activitiesWithUserInfo = data?.map(activity => ({
        ...activity,
        user_email: activity.created_by ? userEmails[activity.created_by] || 'Unknown User' : 'System'
      })) || [];

      setActivities(activitiesWithUserInfo);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
      
      {activities.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <Clock className="mx-auto h-12 w-12 mb-2 opacity-50" />
          <p>No activity recorded yet</p>
        </div>
      ) : (
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const IconComponent = activityIcons[activity.activity_type as keyof typeof activityIcons] || activityIcons.default;
              const colorClass = activityColors[activity.activity_type as keyof typeof activityColors] || activityColors.default;
              
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className={`p-2 rounded-full ${colorClass}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {activity.activity_type.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            by {activity.user_email}
                          </span>
                        </div>
                        
                        {activity.details && Object.keys(activity.details).length > 0 && (
                          <div className="mt-2 p-2 bg-muted rounded text-xs">
                            {Object.entries(activity.details).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium">{key.replace('_', ' ')}:</span>
                                <span>{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    
                    {index < activities.length - 1 && (
                      <div className="h-4 w-px bg-border ml-4 mt-2"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}