import React, { useState, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JobCard } from './JobCard';
import { Order, Engineer, updateOrderAssignment } from '@/utils/schedulingUtils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { Clock, Calendar, CheckCircle, XCircle, AlertTriangle, Package, Ban } from 'lucide-react';

interface ScheduleKanbanProps {
  orders: Order[];
  engineers: Engineer[];
  onOrderUpdate: () => void;
  onShowRecommendations?: (order: Order) => void;
}

interface KanbanBucket {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  statusValues: string[];
  color: string;
  description: string;
}

const kanbanBuckets: KanbanBucket[] = [
  {
    id: 'needs_scheduling',
    title: 'Needs Scheduling',
    icon: Clock,
    statusValues: ['needs_scheduling', 'awaiting_install_booking'],
    color: 'border-orange-200 bg-orange-50',
    description: 'Jobs that need to be scheduled'
  },
  {
    id: 'date_offered',
    title: 'Date Offered',
    icon: Calendar,
    statusValues: ['date_offered'],
    color: 'border-blue-200 bg-blue-50',
    description: 'Dates offered to clients, awaiting response'
  },
  {
    id: 'date_accepted',
    title: 'Ready to Book',
    icon: CheckCircle,
    statusValues: ['date_accepted', 'scheduled'],
    color: 'border-green-200 bg-green-50',
    description: 'Client accepted date, ready for final booking'
  },
  {
    id: 'date_rejected',
    title: 'Date Rejected',
    icon: XCircle,
    statusValues: ['date_rejected'],
    color: 'border-red-200 bg-red-50',
    description: 'Client rejected offered date'
  },
  {
    id: 'offer_expired',
    title: 'Offer Expired',
    icon: AlertTriangle,
    statusValues: ['offer_expired'],
    color: 'border-yellow-200 bg-yellow-50',
    description: 'Offers that have expired without response'
  },
  {
    id: 'on_hold',
    title: 'On Hold - Parts/Docs',
    icon: Package,
    statusValues: ['on_hold_parts_docs'],
    color: 'border-purple-200 bg-purple-50',
    description: 'Waiting for parts or documentation'
  },
  {
    id: 'cancelled',
    title: 'Cancelled',
    icon: Ban,
    statusValues: ['cancelled'],
    color: 'border-gray-200 bg-gray-50',
    description: 'Cancelled jobs'
  }
];

function KanbanColumn({ 
  bucket, 
  orders, 
  engineers, 
  onDrop, 
  onShowRecommendations 
}: {
  bucket: KanbanBucket;
  orders: Order[];
  engineers: Engineer[];
  onDrop: (orderId: string, newStatus: string) => void;
  onShowRecommendations?: (order: Order) => void;
}) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'job',
    drop: (item: { orderId: string; order: Order }) => {
      // Map bucket ID to the primary status value
      const statusMapping: Record<string, string> = {
        'needs_scheduling': 'needs_scheduling',
        'date_offered': 'date_offered',
        'date_accepted': 'date_accepted',
        'date_rejected': 'date_rejected',
        'offer_expired': 'offer_expired',
        'on_hold': 'on_hold_parts_docs',
        'cancelled': 'cancelled'
      };
      
      const newStatus = statusMapping[bucket.id];
      if (newStatus) {
        onDrop(item.orderId, newStatus);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [bucket.id, onDrop]);

  const bucketOrders = orders.filter(order => 
    bucket.statusValues.includes(order.status_enhanced)
  );

  const IconComponent = bucket.icon;

  return (
    <Card 
      ref={drop}
      className={`
        ${bucket.color} 
        ${isOver ? 'ring-2 ring-primary' : ''}
        transition-all duration-200 h-fit min-h-[400px]
      `}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <IconComponent className="h-4 w-4" />
            {bucket.title}
          </div>
          <Badge variant="secondary" className="text-xs">
            {bucketOrders.length}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{bucket.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {bucketOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <IconComponent className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No jobs</p>
          </div>
        ) : (
          bucketOrders.map(order => (
            <JobCard
              key={order.id}
              order={order}
              engineers={engineers}
              isDraggable
              onShowRecommendations={onShowRecommendations}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function ScheduleKanban({ 
  orders, 
  engineers, 
  onOrderUpdate, 
  onShowRecommendations 
}: ScheduleKanbanProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusChange = useCallback(async (orderId: string, newStatus: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status_enhanced: newStatus as Database['public']['Enums']['order_status_enhanced'],
          // Clear engineer assignment and date if moving back to needs scheduling
          ...(newStatus === 'needs_scheduling' && {
            engineer_id: null,
            scheduled_install_date: null
          }),
          // Clear scheduled date if rejected or expired
          ...((newStatus === 'date_rejected' || newStatus === 'offer_expired') && {
            scheduled_install_date: null
          })
        })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Job status updated');
      onOrderUpdate();
    } catch (error) {
      console.error('Error updating job status:', error);
      toast.error('Failed to update job status');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onOrderUpdate]);

  // Stats calculation
  const totalJobs = orders.length;
  const needsScheduling = orders.filter(o => 
    kanbanBuckets[0].statusValues.includes(o.status_enhanced)
  ).length;
  const inProgress = orders.filter(o => 
    ['date_offered', 'date_accepted', 'scheduled'].includes(o.status_enhanced)
  ).length;
  const issues = orders.filter(o => 
    ['date_rejected', 'offer_expired', 'on_hold_parts_docs'].includes(o.status_enhanced)
  ).length;

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Scheduling Pipeline</h2>
          <div className="flex gap-4 mt-2">
            <Badge variant="outline" className="text-sm">
              {totalJobs} Total Jobs
            </Badge>
            <Badge variant="destructive" className="text-sm">
              {needsScheduling} Need Scheduling
            </Badge>
            <Badge variant="default" className="text-sm">
              {inProgress} In Progress
            </Badge>
            {issues > 0 && (
              <Badge variant="destructive" className="text-sm">
                {issues} Issues
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 overflow-x-auto">
        {kanbanBuckets.map(bucket => (
          <KanbanColumn
            key={bucket.id}
            bucket={bucket}
            orders={orders}
            engineers={engineers}
            onDrop={handleStatusChange}
            onShowRecommendations={onShowRecommendations}
          />
        ))}
      </div>

      {/* Help Text */}
      <div className="text-center text-sm text-muted-foreground mt-6">
        <p>💡 Drag jobs between columns to update their status automatically</p>
      </div>
    </div>
  );
}