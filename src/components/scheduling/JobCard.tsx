import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Order, Engineer, getStatusColor } from '@/utils/schedulingUtils';
import { MapPin, User, Calendar, Clock, Eye, Package, CalendarDays, Users } from 'lucide-react';

interface JobCardProps {
  order: Order;
  engineers: Engineer[];
  onJobDrop?: (orderId: string, engineerId: string, slotInfo: any) => void;
  isDraggable?: boolean;
  showFullDetails?: boolean;
  onShowRecommendations?: (order: Order) => void;
  onStartDrag?: (order: Order) => void;
}

export function JobCard({ 
  order, 
  engineers, 
  onJobDrop, 
  isDraggable = false, 
  showFullDetails = false, 
  onShowRecommendations,
  onStartDrag 
}: JobCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'job',
    item: () => {
      onStartDrag?.(order);
      return { 
        orderId: order.id,
        order,
        title: `Order #${order.order_number}`
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [order, onStartDrag]);

  const statusColor = getStatusColor(order.status_enhanced);
  
  // Parse scheduling conflicts safely
  let conflicts: any[] = [];
  if (order.scheduling_conflicts) {
    try {
      conflicts = Array.isArray(order.scheduling_conflicts) 
        ? order.scheduling_conflicts 
        : JSON.parse(order.scheduling_conflicts as string);
    } catch (e) {
      // Ignore parsing errors
    }
  }
  const hasConflicts = conflicts.length > 0;

  // Get product details - simplified for now
  const getProductInfo = () => {
    // TODO: Add quote items relationship to Order type when available
    return null;
  };

  const productInfo = getProductInfo();

  const JobDetailsModal = () => (
    <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {order.order_number} - Job Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Client Information</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Name:</strong> {order.client?.full_name}</p>
                <p><strong>Email:</strong> {order.client?.email}</p>
                <p><strong>Phone:</strong> {order.client?.phone}</p>
                <p><strong>Address:</strong> {order.job_address || order.client?.address}</p>
                <p><strong>Postcode:</strong> {order.postcode}</p>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Job Information</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Status:</strong> {order.status_enhanced.replace('_', ' ')}</p>
                <p><strong>Total Amount:</strong> £{order.total_amount}</p>
                <p><strong>Deposit:</strong> £{order.deposit_amount}</p>
                <p><strong>Amount Paid:</strong> £{order.amount_paid}</p>
                {order.estimated_duration_hours && (
                  <p><strong>Duration:</strong> {order.estimated_duration_hours}h</p>
                )}
              </div>
            </div>
          </div>
          
          {productInfo && (
            <div>
              <h4 className="font-medium mb-2">Product Details</h4>
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium">{productInfo.productName}</p>
                <p className="text-sm text-muted-foreground">
                  Quantity: {productInfo.quantity}
                  {productInfo.totalItems > 1 && ` (+${productInfo.totalItems - 1} more items)`}
                </p>
              </div>
            </div>
          )}

          {order.installation_notes && (
            <div>
              <h4 className="font-medium mb-2">Installation Notes</h4>
              <p className="text-sm bg-muted p-3 rounded-lg">{order.installation_notes}</p>
            </div>
          )}

          {hasConflicts && (
            <div>
              <h4 className="font-medium mb-2 text-destructive">Scheduling Conflicts</h4>
              <div className="space-y-2">
                {conflicts.map((conflict, index) => (
                  <div key={index} className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    <p className="text-sm text-destructive">{conflict.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <Card 
        ref={isDraggable ? drag : undefined}
        className={`
          cursor-pointer transition-all duration-200 hover:shadow-md
          ${isDragging ? 'opacity-50 scale-95' : ''}
          ${hasConflicts ? 'border-destructive' : ''}
          ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
      >
        <CardContent className="p-3">
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm">{order.order_number}</h4>
                <p className="text-xs text-muted-foreground truncate">
                  {order.client?.full_name}
                </p>
                {productInfo && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          <Package className="h-3 w-3 inline mr-1" />
                          {productInfo.productName}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{productInfo.productName}</p>
                        <p>Quantity: {productInfo.quantity}</p>
                        {productInfo.totalItems > 1 && (
                          <p>+{productInfo.totalItems - 1} more items</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge 
                  variant="outline" 
                  style={{ 
                    borderColor: statusColor,
                    color: statusColor 
                  }}
                  className="text-xs"
                >
                  {order.status_enhanced.replace('_', ' ')}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsDetailsOpen(true)}
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Enhanced Details */}
            <div className="space-y-1 text-xs text-muted-foreground">
              {/* Postcode/Address - always show postcode, full address on hover */}
              {(order.postcode || order.job_address) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">
                          {order.postcode || order.job_address?.split(',').pop()?.trim()}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{order.job_address || order.client?.address}</p>
                      {order.postcode && <p>Postcode: {order.postcode}</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* TODO: Add preferred install date when available in Order type */}
              
              {order.engineer && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{order.engineer.name}</span>
                  {order.engineer.region && (
                    <span className="text-xs opacity-75">({order.engineer.region})</span>
                  )}
                </div>
              )}

              {order.scheduled_install_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(order.scheduled_install_date).toLocaleDateString()}</span>
                </div>
              )}

              {order.time_window && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{order.time_window}</span>
                </div>
              )}

              {order.estimated_duration_hours && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{order.estimated_duration_hours}h estimated</span>
                </div>
              )}

              {/* Price info for unassigned jobs */}
              {isDraggable && (
                <div className="flex items-center gap-1 font-medium text-green-600">
                  <span>£{order.total_amount}</span>
                  {order.deposit_amount > 0 && (
                    <span className="text-xs">
                      (£{order.deposit_amount} deposit)
                    </span>
                  )}
                </div>
              )}
            </div>

          {/* Conflicts */}
          {hasConflicts && (
            <div className="mt-2 p-2 bg-destructive/10 rounded border border-destructive/20">
              <div className="flex items-center gap-1 text-destructive text-xs font-medium">
                ⚠️ Conflicts Detected
              </div>
              {conflicts.map((conflict, index) => (
                <div key={index} className="text-xs text-destructive mt-1">
                  {conflict.message}
                </div>
              ))}
            </div>
          )}

            {/* Actions for unassigned jobs */}
            {isDraggable && (
              <div className="mt-2 pt-2 border-t border-border space-y-2">
                {onShowRecommendations && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => onShowRecommendations(order)}
                  >
                    <Users className="h-3 w-3 mr-1" />
                    Show Recommendations
                  </Button>
                )}
                <div className="text-center">
                  <span className="text-xs text-muted-foreground">
                    📍 Drag to assign to calendar
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <JobDetailsModal />
    </>
  );
}