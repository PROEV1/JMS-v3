import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  MapPin, 
  Clock,
  Truck,
  AlertTriangle,
  CheckCircle,
  MoreVertical,
  Phone
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

interface MobileDispatchOrder {
  id: string;
  order_number: string;
  client_name: string;
  postcode: string;
  phone: string;
  scheduled_install_date: string;
  engineer_name: string;
  dispatch_status: string;
  urgency_level: string;
  days_until_install: number;
  job_type: string;
}

interface MobileDispatchViewProps {
  orders: MobileDispatchOrder[];
  isLoading: boolean;
  onMarkDispatched: (orderId: string) => void;
  onFlagIssue: (orderId: string) => void;
  onRefresh: () => void;
}

export function MobileDispatchView({ 
  orders, 
  isLoading, 
  onMarkDispatched, 
  onFlagIssue,
  onRefresh
}: MobileDispatchViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.postcode.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = selectedStatus === 'all' || order.dispatch_status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string, urgency: string) => {
    switch (status) {
      case 'dispatched':
        return <Truck className="h-4 w-4 text-green-600" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'issue':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return urgency === 'urgent' ? 
          <AlertTriangle className="h-4 w-4 text-orange-600" /> :
          <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string, urgency: string) => {
    switch (status) {
      case 'dispatched':
        return <Badge variant="default" className="text-xs">Dispatched</Badge>;
      case 'delivered':
        return <Badge variant="secondary" className="text-xs">Delivered</Badge>;
      case 'issue':
        return <Badge variant="destructive" className="text-xs">Issue</Badge>;
      default:
        return urgency === 'urgent' ? 
          <Badge variant="destructive" className="text-xs">Urgent</Badge> :
          <Badge variant="outline" className="text-xs">Pending</Badge>;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'border-l-red-500';
      case 'warning': return 'border-l-orange-500';
      case 'success': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Mobile Header with Search and Filters */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <div className="space-y-4">
                <h3 className="font-semibold">Filter Orders</h3>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select 
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending_dispatch">Pending</option>
                    <option value="dispatched">Dispatched</option>
                    <option value="delivered">Delivered</option>
                    <option value="issue">Issues</option>
                  </select>
                </div>
                
                <Button onClick={onRefresh} className="w-full">
                  Refresh Data
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{filteredOrders.length} orders</span>
          <span>•</span>
          <span>{filteredOrders.filter(o => o.urgency_level === 'urgent').length} urgent</span>
        </div>
      </div>

      {/* Orders List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredOrders.map((order) => (
            <Card key={order.id} className={`border-l-4 ${getUrgencyColor(order.urgency_level)}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Header Row */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(order.dispatch_status, order.urgency_level)}
                        <span className="font-semibold text-sm">{order.order_number}</span>
                        {getStatusBadge(order.dispatch_status, order.urgency_level)}
                      </div>
                      <p className="text-sm text-muted-foreground">{order.client_name}</p>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(`tel:${order.phone}`)}>
                          <Phone className="h-4 w-4 mr-2" />
                          Call Client
                        </DropdownMenuItem>
                        {order.dispatch_status === 'pending_dispatch' && (
                          <DropdownMenuItem onClick={() => onMarkDispatched(order.id)}>
                            <Truck className="h-4 w-4 mr-2" />
                            Mark Dispatched
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onFlagIssue(order.id)}>
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Flag Issue
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{order.postcode}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="truncate">{order.engineer_name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(order.scheduled_install_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {order.days_until_install > 0 
                          ? `${order.days_until_install}d left`
                          : `${Math.abs(order.days_until_install)}d overdue`
                        }
                      </span>
                    </div>
                  </div>

                  {/* Job type badge */}
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-xs">
                      {order.job_type?.replace('_', ' ').toUpperCase()}
                    </Badge>
                    
                    {order.urgency_level === 'urgent' && (
                      <span className="text-xs text-red-600 font-medium">
                        URGENT
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No orders found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}