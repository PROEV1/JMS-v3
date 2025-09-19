import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Paginator } from '@/components/ui/Paginator';
import { MoreHorizontal, Eye, Package, AlertTriangle, CheckCircle, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getJobTypeLabel } from '@/utils/jobTypeUtils';

interface DispatchOrder {
  id: string;
  order_number: string;
  scheduled_install_date: string;
  status_enhanced: string;
  job_type?: string;
  clients: {
    full_name: string;
    postcode: string;
    phone: string;
  };
  engineers?: {
    name: string;
    region: string;
  };
  dispatch_status: string;
  urgency_level: string;
  days_until_install: number;
  dispatch_record?: {
    tracking_number?: string;
    dispatched_at?: string;
    notes?: string;
    dispatched_by_name?: string;
  };
}

interface ChargerDispatchTableProps {
  orders: DispatchOrder[];
  isLoading: boolean;
  onMarkAsDispatched: (orderId: string) => void;
  onFlagIssue?: (orderId: string) => void;
  selectedOrders?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  pagination: {
    page: number;
    pageSize: number;
  };
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function ChargerDispatchTable({
  orders,
  isLoading,
  onMarkAsDispatched,
  onFlagIssue,
  selectedOrders = [],
  onSelectionChange,
  pagination,
  totalCount,
  onPageChange,
  onPageSizeChange
}: ChargerDispatchTableProps) {
  const navigate = useNavigate();

  const getDispatchStatusBadge = (status: string, urgencyLevel: string) => {
    const baseClasses = "text-xs font-medium";
    
    switch (status) {
      case 'not_required':
        return <Badge variant="secondary" className={baseClasses}>Not Required</Badge>;
      case 'pending_dispatch':
        if (urgencyLevel === 'urgent') {
          return <Badge variant="destructive" className={`${baseClasses} bg-red-500`}>⚠ Urgent</Badge>;
        } else if (urgencyLevel === 'warning') {
          return <Badge variant="destructive" className={`${baseClasses} bg-orange-500`}>⏰ Due Soon</Badge>;
        }
        return <Badge variant="outline" className={baseClasses}>Pending</Badge>;
      case 'sent':
        return <Badge variant="default" className={`${baseClasses} bg-green-500`}>✓ Dispatched</Badge>;
      case 'delivered':
        return <Badge variant="default" className={`${baseClasses} bg-blue-500`}>Delivered</Badge>;
      case 'issue':
        return <Badge variant="destructive" className={baseClasses}>⚠ Issue</Badge>;
      default:
        return <Badge variant="outline" className={baseClasses}>{status}</Badge>;
    }
  };

  const getUrgencyIcon = (urgencyLevel: string, dispatchStatus: string) => {
    if (urgencyLevel === 'urgent' && dispatchStatus === 'pending_dispatch') {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    if (dispatchStatus === 'sent') {
      return <Truck className="h-4 w-4 text-green-500" />;
    }
    if (dispatchStatus === 'pending_dispatch') {
      return <Package className="h-4 w-4 text-orange-500" />;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-muted/20 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Job ID</TableHead>
            <TableHead>Client Name</TableHead>
            <TableHead className="w-[100px]">Postcode</TableHead>
            <TableHead className="w-[140px]">Install Date</TableHead>
            <TableHead className="w-[140px]">Dispatch Status</TableHead>
            <TableHead className="w-[120px]">Courier</TableHead>
            <TableHead className="w-[120px]">Tracking</TableHead>
            <TableHead className="w-[120px]">Dispatched By</TableHead>
            <TableHead>Engineer</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                No orders found matching your criteria
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getUrgencyIcon(order.urgency_level, order.dispatch_status)}
                    <div className="font-mono text-sm">{order.order_number}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{order.clients.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {getJobTypeLabel(order.job_type)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-mono text-sm">{order.clients.postcode}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {format(new Date(order.scheduled_install_date), 'dd/MM/yyyy')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order.days_until_install >= 0 
                      ? `${order.days_until_install} days`
                      : `${Math.abs(order.days_until_install)} days ago`
                    }
                  </div>
                </TableCell>
                <TableCell>
                  {getDispatchStatusBadge(order.dispatch_status, order.urgency_level)}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {(() => {
                      if (!order.dispatch_record?.notes) return '-';
                      // Extract courier name from notes (format: "Courier: [name]\n...")
                      const courierMatch = order.dispatch_record.notes.match(/^Courier: (.+?)$/m);
                      return courierMatch ? courierMatch[1] : '-';
                    })()}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-mono">
                    {order.dispatch_record?.tracking_number || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {order.dispatch_record?.dispatched_by_name || '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order.dispatch_record?.dispatched_at 
                      ? format(new Date(order.dispatch_record.dispatched_at), 'dd/MM/yyyy')
                      : ''
                    }
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {order.engineers?.name || 'Unassigned'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order.engineers?.region || ''}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Order
                      </DropdownMenuItem>
                      {order.dispatch_status === 'pending_dispatch' && (
                        <DropdownMenuItem 
                          onClick={() => onMarkAsDispatched(order.id)}
                        >
                          <Package className="mr-2 h-4 w-4" />
                          Mark as Dispatched
                        </DropdownMenuItem>
                      )}
                      {onFlagIssue && (
                        <DropdownMenuItem 
                          onClick={() => onFlagIssue(order.id)}
                        >
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          Flag Issue
                        </DropdownMenuItem>
                      )}
                      {order.dispatch_status === 'dispatched' && (
                        <DropdownMenuItem>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Mark as Delivered
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Paginator
        currentPage={pagination.page}
        totalItems={totalCount}
        onPageChange={onPageChange}
        pageSize={pagination.pageSize}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}