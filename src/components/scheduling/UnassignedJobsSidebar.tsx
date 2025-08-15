import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JobCard } from './JobCard';
import { Order, Engineer } from '@/utils/schedulingUtils';
import { AlertTriangle } from 'lucide-react';

interface UnassignedJobsSidebarProps {
  orders: Order[];
  engineers: Engineer[];
  onJobDrop: (orderId: string, engineerId: string, slotInfo: any) => void;
  onShowRecommendations?: (order: Order) => void;
  onStartDrag?: (order: Order) => void;
}

export function UnassignedJobsSidebar({ orders, engineers, onJobDrop, onShowRecommendations, onStartDrag }: UnassignedJobsSidebarProps) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Unassigned Jobs
          <span className="bg-warning text-warning-foreground text-xs px-2 py-1 rounded-full">
            {orders.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No unassigned jobs</p>
            <p className="text-xs">All jobs are scheduled!</p>
          </div>
        ) : (
           orders.map(order => (
            <JobCard
              key={order.id}
              order={order}
              engineers={engineers}
              onJobDrop={onJobDrop}
              onShowRecommendations={onShowRecommendations}
              onStartDrag={onStartDrag}
              isDraggable
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}