import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Clock, Package, Truck, Calendar, MapPin, User, Search, Plus, Filter, Trash2, Edit } from 'lucide-react';
import { useStockRequests, useUpdateStockRequestStatus, useDeleteStockRequest } from '@/hooks/useStockRequests';
import { StockRequestWithDetails, StockRequestStatus } from '@/types/stock-request';
import { format } from 'date-fns';
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { QuickActionsBlock } from './shared/QuickActionsBlock';
import { CreateStockRequestModal } from './CreateStockRequestModal';
import { CreateRMAModal } from './CreateRMAModal';
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { AmendStockRequestModal } from './AmendStockRequestModal';

const statusIcons = {
  submitted: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  in_pick: Package,
  in_transit: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
  amend: Package
};

import { StatusChip } from './shared/StatusChip';

const formatStatus = (status: StockRequestStatus) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

interface RequestCardProps {
  request: StockRequestWithDetails;
  onStatusChange: (id: string, status: StockRequestStatus, notes?: string) => void;
  onCreatePurchaseOrder?: (request: StockRequestWithDetails) => void;
  onAmendRequest?: (request: StockRequestWithDetails) => void;
  onDeleteRequest?: (requestId: string) => void;
}

const RequestCard: React.FC<RequestCardProps> = ({ request, onStatusChange, onCreatePurchaseOrder, onAmendRequest, onDeleteRequest }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [newStatus, setNewStatus] = useState<StockRequestStatus | ''>('');
  const [statusNotes, setStatusNotes] = useState('');

  const StatusIcon = statusIcons[request.status];
  const priorityColor = request.priority === 'high' ? 'destructive' : 
                       request.priority === 'medium' ? 'outline' : 'secondary';

  const handleStatusChange = () => {
    if (newStatus) {
      if (newStatus === 'amend') {
        onAmendRequest?.(request);
        setShowStatusChange(false);
        setNewStatus('');
        setStatusNotes('');
      } else {
        onStatusChange(request.id, newStatus as StockRequestStatus, statusNotes || undefined);
        setShowStatusChange(false);
        setNewStatus('');
        setStatusNotes('');
      }
    }
  };

  const getAvailableStatusTransitions = (currentStatus: StockRequestStatus): StockRequestStatus[] => {
    switch (currentStatus) {
      case 'submitted': return ['approved', 'rejected', 'amend'];
      case 'approved': return ['in_pick', 'cancelled', 'amend'];
      case 'in_pick': return ['in_transit', 'cancelled', 'amend'];
      case 'in_transit': return ['delivered'];
      default: return [];
    }
  };

  const availableTransitions = getAvailableStatusTransitions(request.status);

  return (
    <div className="mb-4">
      <Card className="hover:shadow-md transition-all border-l-4 border-l-primary/20">{/* Added left border accent */}
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <StatusIcon className="h-3 w-3" />
                #{request.id.slice(0, 8)}
              </CardTitle>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {request.engineer.name}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={priorityColor} className="text-xs">
                {request.priority}
              </Badge>
              <StatusChip status={request.status as any}>
                {formatStatus(request.status)}
              </StatusChip>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2 pt-0">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{request.destination_location.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span>{format(new Date(request.created_at), 'MMM d')}</span>
            </div>
            {request.needed_by && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>Need by {format(new Date(request.needed_by), 'MMM d')}</span>
              </div>
            )}
          </div>

          <div className="text-xs">
            <div className="font-medium">{request.lines.length} item{request.lines.length !== 1 ? 's' : ''}</div>
            <div className="text-muted-foreground space-y-0.5">
              {request.lines.slice(0, 2).map((line) => (
                <div key={line.id} className="truncate">
                  {line.qty}x {line.item.name}
                </div>
              ))}
              {request.lines.length > 2 && (
                <div className="text-xs">+{request.lines.length - 2} more</div>
              )}
            </div>
          </div>

          <div className="flex gap-1 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={() => setShowDetails(true)}
            >
              Details
            </Button>
            {availableTransitions.length > 0 && (
              <Button
                variant="default"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setShowStatusChange(true)}
              >
                Update
              </Button>
            )}
            {request.status === 'in_transit' && !request.purchase_order_id && (
              <Button
                variant="secondary"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => onCreatePurchaseOrder?.(request)}
              >
                Create PO
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={() => onDeleteRequest?.(request.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
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
                <StatusChip status={request.status as any}>
                  {formatStatus(request.status)}
                </StatusChip>
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
                 <SelectContent className="bg-background border border-border shadow-lg z-50">
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
    </div>
  );
};

export const AdminStockRequestsBoard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockRequestStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'tiles' | 'board'>('tiles');
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [showCreateRMA, setShowCreateRMA] = useState(false);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [showAmendRequest, setShowAmendRequest] = useState(false);
  const [selectedStockRequest, setSelectedStockRequest] = useState<StockRequestWithDetails | null>(null);
  
  const { data: requests, isLoading } = useStockRequests();
  const updateStatus = useUpdateStockRequestStatus();
  const deleteRequest = useDeleteStockRequest();

  const handleStatusChange = (id: string, status: StockRequestStatus, notes?: string) => {
    updateStatus.mutate({ id, status, notes });
  };

  const handleCreatePurchaseOrder = (request: StockRequestWithDetails) => {
    setSelectedStockRequest(request);
    setShowCreatePO(true);
  };

  const handleAmendRequest = (request: StockRequestWithDetails) => {
    setSelectedStockRequest(request);
    setShowAmendRequest(true);
  };

  const handleDeleteRequest = (requestId: string) => {
    if (confirm('Are you sure you want to delete this stock request? This action cannot be undone.')) {
      deleteRequest.mutate(requestId);
    }
  };

  // Calculate metrics
  const metrics = React.useMemo(() => {
    if (!requests) return {};
    
    const submitted = requests.filter(r => r.status === 'submitted').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const inPick = requests.filter(r => r.status === 'in_pick').length;
    const inTransit = requests.filter(r => r.status === 'in_transit').length;
    const delivered = requests.filter(r => r.status === 'delivered').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    const total = requests.length;
    
    return { submitted, approved, inPick, inTransit, delivered, rejected, total };
  }, [requests]);

  // Filter requests
  const filteredRequests = React.useMemo(() => {
    if (!requests) return [];
    
    return requests.filter(request => {
      const matchesSearch = searchQuery === '' || 
        request.engineer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.destination_location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.lines.some(line => line.item.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchQuery, statusFilter]);

  const quickActions = [
    {
      label: "New Request",
      icon: Plus,
      onClick: () => setShowCreateRequest(true),
      variant: 'default' as const
    },
    {
      label: "Create Return/RMA",
      icon: Package,
      onClick: () => setShowCreateRMA(true),
      variant: 'secondary' as const
    },
    {
      label: "Export",
      icon: Filter,
      onClick: () => {/* TODO: Export requests */},
      variant: 'secondary' as const
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const groupedRequests = filteredRequests?.reduce((acc, request) => {
    if (!acc[request.status]) {
      acc[request.status] = [];
    }
    acc[request.status].push(request);
    return acc;
  }, {} as Record<StockRequestStatus, StockRequestWithDetails[]>) || {};

  const statusOrder: StockRequestStatus[] = ['submitted', 'approved', 'in_pick', 'in_transit', 'delivered', 'rejected', 'cancelled'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Stock Requests</h2>
        <p className="text-muted-foreground">
          Track and manage stock requests from engineers
        </p>
      </div>

      {/* KPI Tiles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InventoryKpiTile
          title="Submitted"
          value={metrics.submitted || 0}
          icon={Clock}
          variant={metrics.submitted > 0 ? "warning" : "neutral"}
          onClick={() => setStatusFilter('submitted')}
          subtitle="Awaiting approval"
        />

        <InventoryKpiTile
          title="In Pick"
          value={metrics.inPick || 0}
          icon={Package}
          variant="info"
          onClick={() => setStatusFilter('in_pick')}
          subtitle="Being prepared"
        />

        <InventoryKpiTile
          title="In Transit"
          value={metrics.inTransit || 0}
          icon={Truck}
          variant="info"
          onClick={() => setStatusFilter('in_transit')}
          subtitle="En route"
        />

        <InventoryKpiTile
          title="Delivered"
          value={metrics.delivered || 0}
          icon={CheckCircle}
          variant="success"
          onClick={() => setStatusFilter('delivered')}
          subtitle="Completed"
        />
      </div>

      {/* Quick Actions */}
      <QuickActionsBlock actions={quickActions} />

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={(value: StockRequestStatus | 'all') => setStatusFilter(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border shadow-lg z-50">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_pick">In Pick</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="amend">Amend</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'tiles' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('tiles')}
          >
            List View
          </Button>
          <Button
            variant={viewMode === 'board' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('board')}
          >
            Board View
          </Button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'tiles' ? (
        /* List View */
        <Card>
          <CardHeader>
            <CardTitle>Stock Requests ({filteredRequests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredRequests.length > 0 ? (
              <div className="space-y-4">
                {filteredRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onStatusChange={handleStatusChange}
                    onCreatePurchaseOrder={handleCreatePurchaseOrder}
                    onAmendRequest={handleAmendRequest}
                    onDeleteRequest={handleDeleteRequest}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery || statusFilter !== 'all' ? 'No requests match your filters' : 'No stock requests yet'}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Board View */
        <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {statusOrder.map((status) => {
            const requestsForStatus = groupedRequests[status] || [];
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm capitalize">
                    {formatStatus(status)}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {requestsForStatus.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {requestsForStatus.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onStatusChange={handleStatusChange}
                      onCreatePurchaseOrder={handleCreatePurchaseOrder}
                      onAmendRequest={handleAmendRequest}
                      onDeleteRequest={handleDeleteRequest}
                    />
                  ))}
                  {requestsForStatus.length === 0 && (
                    <div className="p-3 text-center text-muted-foreground text-xs bg-muted/30 rounded-lg">
                      No {status} requests
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Modals */}
      <CreateStockRequestModal
        open={showCreateRequest}
        onOpenChange={setShowCreateRequest}
      />
      
      <CreateRMAModal
        open={showCreateRMA}
        onOpenChange={setShowCreateRMA}
      />
      
      <CreatePurchaseOrderModal
        open={showCreatePO}
        onOpenChange={(open) => {
          setShowCreatePO(open);
          if (!open) setSelectedStockRequest(null);
        }}
        stockRequest={selectedStockRequest}
      />
      
      <AmendStockRequestModal
        open={showAmendRequest}
        onOpenChange={(open) => {
          setShowAmendRequest(open);
          if (!open) setSelectedStockRequest(null);
        }}
        request={selectedStockRequest}
      />
    </div>
  );
};
