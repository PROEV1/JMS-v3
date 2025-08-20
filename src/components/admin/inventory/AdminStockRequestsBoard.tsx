
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, Package, Truck, Calendar, MapPin, User } from 'lucide-react';
import { useStockRequests, useUpdateStockRequestStatus } from '@/hooks/useStockRequests';
import { StockRequestWithDetails, StockRequestStatus } from '@/types/stock-request';
import { format } from 'date-fns';

const statusIcons = {
  submitted: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  in_pick: Package,
  in_transit: Truck,
  delivered: CheckCircle,
  cancelled: XCircle
};

const statusColors = {
  submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  in_pick: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_transit: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
};

const formatStatus = (status: StockRequestStatus) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

interface RequestCardProps {
  request: StockRequestWithDetails;
  onStatusChange: (id: string, status: StockRequestStatus, notes?: string) => void;
}

const RequestCard: React.FC<RequestCardProps> = ({ request, onStatusChange }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [newStatus, setNewStatus] = useState<StockRequestStatus | ''>('');
  const [statusNotes, setStatusNotes] = useState('');

  const StatusIcon = statusIcons[request.status];
  const priorityColor = request.priority === 'high' ? 'destructive' : 
                       request.priority === 'medium' ? 'outline' : 'secondary';

  const handleStatusChange = () => {
    if (newStatus) {
      onStatusChange(request.id, newStatus as StockRequestStatus, statusNotes || undefined);
      setShowStatusChange(false);
      setNewStatus('');
      setStatusNotes('');
    }
  };

  const getAvailableStatusTransitions = (currentStatus: StockRequestStatus): StockRequestStatus[] => {
    switch (currentStatus) {
      case 'submitted': return ['approved', 'rejected'];
      case 'approved': return ['in_pick', 'cancelled'];
      case 'in_pick': return ['in_transit', 'cancelled'];
      case 'in_transit': return ['delivered'];
      default: return [];
    }
  };

  const availableTransitions = getAvailableStatusTransitions(request.status);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-base flex items-center gap-2">
                <StatusIcon className="h-4 w-4" />
                Request #{request.id.slice(0, 8)}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                {request.engineer.name}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={priorityColor}>
                {request.priority}
              </Badge>
              <Badge className={statusColors[request.status]}>
                {formatStatus(request.status)}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span>{request.destination_location.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span>Created {format(new Date(request.created_at), 'MMM d, yyyy')}</span>
            </div>
            {request.needed_by && (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>Needed by {format(new Date(request.needed_by), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">{request.lines.length} item{request.lines.length !== 1 ? 's' : ''}:</div>
            <div className="text-sm text-muted-foreground">
              {request.lines.slice(0, 2).map((line, idx) => (
                <div key={line.id}>
                  {line.qty}x {line.item.name}
                </div>
              ))}
              {request.lines.length > 2 && (
                <div className="text-xs">...and {request.lines.length - 2} more</div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(true)}
            >
              View Details
            </Button>
            {availableTransitions.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowStatusChange(true)}
              >
                Update Status
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock Request Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Engineer:</span> {request.engineer.name}
              </div>
              <div>
                <span className="font-medium">Priority:</span> 
                <Badge variant={priorityColor} className="ml-2">
                  {request.priority}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Destination:</span> {request.destination_location.name}
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <Badge className={`ml-2 ${statusColors[request.status]}`}>
                  {formatStatus(request.status)}
                </Badge>
              </div>
            </div>

            {request.order && (
              <div className="text-sm">
                <span className="font-medium">Linked Order:</span> {request.order.order_number}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-medium">Items:</h4>
              <div className="space-y-2">
                {request.lines.map((line) => (
                  <div key={line.id} className="flex justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <span className="font-medium">{line.item.name}</span>
                      <span className="text-muted-foreground ml-2">({line.item.sku})</span>
                      {line.notes && (
                        <div className="text-sm text-muted-foreground mt-1">{line.notes}</div>
                      )}
                    </div>
                    <div>
                      <span className="font-medium">{line.qty} {line.item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {request.notes && (
              <div className="space-y-2">
                <h4 className="font-medium">Notes:</h4>
                <p className="text-sm p-3 bg-muted/30 rounded-lg">{request.notes}</p>
              </div>
            )}

            {request.photo_url && (
              <div className="space-y-2">
                <h4 className="font-medium">Photo:</h4>
                <img 
                  src={request.photo_url} 
                  alt="Request attachment"
                  className="max-w-full rounded-lg border"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Change Modal */}
      <Dialog open={showStatusChange} onOpenChange={setShowStatusChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Request Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Status</label>
              <Select value={newStatus} onValueChange={(value: string) => setNewStatus(value as StockRequestStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {availableTransitions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatStatus(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add notes about this status change..."
                className="mt-2"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowStatusChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleStatusChange} disabled={!newStatus}>
                Update Status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const AdminStockRequestsBoard: React.FC = () => {
  const { data: requests, isLoading } = useStockRequests();
  const updateStatus = useUpdateStockRequestStatus();

  const handleStatusChange = (id: string, status: StockRequestStatus, notes?: string) => {
    updateStatus.mutate({ id, status, notes });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading stock requests...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedRequests = requests?.reduce((acc, request) => {
    if (!acc[request.status]) {
      acc[request.status] = [];
    }
    acc[request.status].push(request);
    return acc;
  }, {} as Record<StockRequestStatus, StockRequestWithDetails[]>) || {};

  const statusOrder: StockRequestStatus[] = ['submitted', 'approved', 'in_pick', 'in_transit', 'delivered', 'rejected', 'cancelled'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Stock Requests</h2>
        <div className="text-sm text-muted-foreground">
          {requests?.length || 0} total requests
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {statusOrder.map((status) => {
          const requestsForStatus = groupedRequests[status] || [];
          return (
            <div key={status} className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-medium capitalize">
                  {formatStatus(status)}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {requestsForStatus.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {requestsForStatus.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onStatusChange={handleStatusChange}
                  />
                ))}
                {requestsForStatus.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground text-sm bg-muted/30 rounded-lg">
                    No {status} requests
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
