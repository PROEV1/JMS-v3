import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Search, Calendar, Package, User, FileText, ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { EngineerStatusBadge } from '@/components/admin/EngineerStatusBadge';

interface Order {
  id: string;
  order_number: string;
  status: string;
  status_enhanced: string;
  engineer_status: string | null;
  total_amount: number;
  amount_paid: number;
  deposit_amount: number;
  created_at: string;
  scheduled_install_date: string | null;
  engineer_id: string | null;
  client: {
    id: string;
    full_name: string;
    email: string;
  };
  quote: {
    quote_number: string;
  };
  engineer?: {
    id: string;
    name: string;
  };
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
  const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(id, full_name, email),
          quote:quotes(quote_number),
          engineer:engineers(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status_enhanced === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'awaiting_payment': return 'bg-yellow-500';
      case 'awaiting_agreement': return 'bg-orange-500';
      case 'awaiting_install_booking': return 'bg-blue-500';
      case 'scheduled': return 'bg-purple-500';
      case 'in_progress': return 'bg-indigo-500';
      case 'install_completed_pending_qa': return 'bg-teal-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'awaiting_payment': return 'Awaiting Payment';
      case 'awaiting_agreement': return 'Awaiting Agreement';
      case 'awaiting_install_booking': return 'Awaiting Install Booking';
      case 'scheduled': return 'Scheduled';
      case 'in_progress': return 'In Progress';
      case 'install_completed_pending_qa': return 'Pending QA';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const handleDeleteOrder = async (orderId: string) => {
    setDeletingOrderId(orderId);
    try {
      const { error } = await supabase.functions.invoke('admin-delete-order', {
        body: { orderId }
      });

      if (error) throw error;

      toast({
        title: "Order Deleted",
        description: "Order has been successfully deleted.",
      });

      // Refresh the orders list
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "Failed to delete order",
        variant: "destructive",
      });
    } finally {
      setDeletingOrderId(null);
    }
  };

  const getOrdersByStatus = (status: string) => {
    return orders.filter(order => order.status_enhanced === status).length;
  };

  const kpiData = [
    {
      title: "Total Orders",
      value: orders.length,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      filter: 'all'
    },
    {
      title: "Awaiting Payment",
      value: getOrdersByStatus('awaiting_payment'),
      icon: Calendar,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      filter: 'awaiting_payment'
    },
    {
      title: "Scheduled",
      value: getOrdersByStatus('scheduled'),
      icon: Package,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      filter: 'scheduled'
    },
    {
      title: "Completed",
      value: getOrdersByStatus('completed'),
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-100",
      filter: 'completed'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Orders Management</h1>
            <p className="text-muted-foreground">View and manage all customer orders</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {kpiData.map((kpi, index) => {
          const IconComponent = kpi.icon;
          return (
            <Card 
              key={index} 
              className="cursor-pointer transition-all hover:shadow-lg"
              onClick={() => setStatusFilter(kpi.filter)}
            >
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 ${kpi.bgColor} rounded-full`}>
                    <IconComponent className={`h-6 w-6 ${kpi.color}`} />
                  </div>
                  <div>
                    <p className="text-3xl font-semibold">{kpi.value}</p>
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order number, client name, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
                  <SelectItem value="awaiting_agreement">Awaiting Agreement</SelectItem>
                  <SelectItem value="awaiting_install_booking">Awaiting Install Booking</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="install_completed_pending_qa">Pending QA</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>
            {filteredOrders.length} of {orders.length} orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No orders found matching your criteria</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Engineer Progress</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Installation Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>
                      <div>
                        <button 
                          onClick={() => navigate(`/admin/client/${order.client.id}`)}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                        >
                          {order.client.full_name}
                        </button>
                        <p className="text-sm text-muted-foreground">{order.client.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-white ${getStatusColor(order.status_enhanced)}`}>
                        {getStatusLabel(order.status_enhanced)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.engineer_status && order.engineer_id ? (
                        <div className="space-y-1">
                          <EngineerStatusBadge status={order.engineer_status} />
                          {order.engineer && (
                            <p className="text-xs text-muted-foreground">{order.engineer.name}</p>
                          )}
                        </div>
                      ) : order.engineer_id ? (
                        <span className="text-xs text-muted-foreground">Engineer assigned</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No engineer assigned</span>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell>
                      <div>
                        <p>{formatCurrency(order.amount_paid)}</p>
                        {order.amount_paid < order.total_amount && (
                          <p className="text-sm text-red-600">
                            Outstanding: {formatCurrency(order.total_amount - order.amount_paid)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {order.scheduled_install_date 
                        ? new Date(order.scheduled_install_date).toLocaleDateString()
                        : 'Not scheduled'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/order/${order.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={deletingOrderId === order.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Order</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete order <strong>{order.order_number}</strong> for <strong>{order.client.full_name}</strong>?
                                <br /><br />
                                This action cannot be undone. This will permanently delete:
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                  <li>The order and all its details</li>
                                  <li>Associated payment records</li>
                                  <li>Activity history</li>
                                  <li>Engineer uploads</li>
                                </ul>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteOrder(order.id)}
                                className="bg-red-600 hover:bg-red-700"
                                disabled={deletingOrderId === order.id}
                              >
                                {deletingOrderId === order.id ? 'Deleting...' : 'Delete Order'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}