
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BrandPage, BrandContainer } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Trash2, Package, Clock, Calendar, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Order {
  id: string;
  order_number: string;
  status: string;
  status_enhanced: string;
  total_amount: number;
  amount_paid: number;
  deposit_amount: number;
  created_at: string;
  scheduled_install_date: string | null;
  agreement_signed_at: string | null;
  engineer_signed_off_at: string | null;
  is_partner_job: boolean;
  partner_status: string | null;
  scheduling_suppressed: boolean;
  scheduling_suppressed_reason?: string;
  // Optional field that might not exist in database
  engineer_status?: string;
  client: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  engineer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  partner?: {
    id: string;
    name: string;
  } | null;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(
            id,
            full_name,
            email
          ),
          engineer:engineers(
            id,
            name,
            email
          ),
          partner:partners(
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match our interface, providing defaults for missing fields
      const transformedOrders: Order[] = (data || []).map(order => ({
        ...order,
      }));

      setOrders(transformedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (order.client?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === 'all' || order.status_enhanced === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate status counts
  const statusCounts = {
    total: orders.length,
    awaiting_payment: orders.filter(o => o.status_enhanced === 'awaiting_payment').length,
    scheduled: orders.filter(o => o.status_enhanced === 'scheduled').length,
    completed: orders.filter(o => o.status_enhanced === 'completed').length,
  };

  const handleDeleteOrder = async (orderId: string) => {
    setDeletingOrderId(orderId);
    try {
      const { error } = await supabase.functions.invoke('admin-delete-order', {
        body: { orderId }
      });

      if (error) throw error;

      setOrders(prev => prev.filter(order => order.id !== orderId));
      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
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

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status === statusFilter ? 'all' : status);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'awaiting_payment':
        return 'bg-yellow-500 text-white';
      case 'awaiting_agreement':
        return 'bg-orange-500 text-white';
      case 'awaiting_install_booking':
        return 'bg-blue-500 text-white';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800';
      case 'install_completed_pending_qa':
        return 'bg-indigo-100 text-indigo-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <BrandPage>
        <BrandContainer>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          </div>
        </BrandContainer>
      </BrandPage>
    );
  }

  return (
    <BrandPage>
      <BrandContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/admin/dashboard')}
                className="text-muted-foreground"
              >
                ← Back to Dashboard
              </Button>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Orders Management</h1>
              <p className="text-muted-foreground">View and manage all customer orders</p>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === 'all' ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleStatusFilter('all')}
            >
              <CardContent className="flex items-center p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{statusCounts.total}</p>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === 'awaiting_payment' ? 'ring-2 ring-yellow-500' : ''
              }`}
              onClick={() => handleStatusFilter('awaiting_payment')}
            >
              <CardContent className="flex items-center p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-yellow-100 rounded-full">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{statusCounts.awaiting_payment}</p>
                    <p className="text-sm text-muted-foreground">Awaiting Payment</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === 'scheduled' ? 'ring-2 ring-purple-500' : ''
              }`}
              onClick={() => handleStatusFilter('scheduled')}
            >
              <CardContent className="flex items-center p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-purple-100 rounded-full">
                    <Calendar className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{statusCounts.scheduled}</p>
                    <p className="text-sm text-muted-foreground">Scheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === 'completed' ? 'ring-2 ring-green-500' : ''
              }`}
              onClick={() => handleStatusFilter('completed')}
            >
              <CardContent className="flex items-center p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-green-100 rounded-full">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{statusCounts.completed}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Orders */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order number, client name, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All Statuses" />
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
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-800">Orders</h2>
              <p className="text-sm text-muted-foreground">
                {filteredOrders.length} of {orders.length} orders
              </p>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                     <TableRow>
                       <TableHead>Order Number</TableHead>
                       <TableHead>Client</TableHead>
                       <TableHead>Status</TableHead>
                       <TableHead>Partner Status</TableHead>
                       <TableHead>Assigned Engineer</TableHead>
                       <TableHead>Total Amount</TableHead>
                       <TableHead>Amount Paid</TableHead>
                       <TableHead>Created</TableHead>
                       <TableHead>Installation Date</TableHead>
                       <TableHead>Actions</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                       <TableRow>
                         <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                           No orders found
                         </TableCell>
                       </TableRow>
                    ) : (
                      filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.order_number}
                          </TableCell>
                           <TableCell>
                             <div>
                               <div className="flex items-center gap-2">
                                 <p className="font-medium">
                                   {order.client?.full_name || 'Unknown Client'}
                                 </p>
                                 {order.client?.email?.includes('placeholder-') && (
                                   <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                     Placeholder
                                   </Badge>
                                 )}
                               </div>
                               <p className="text-sm text-muted-foreground">
                                 {order.client?.email || 'No email'}
                               </p>
                               <div className="flex gap-1 mt-1">
                                 {order.is_partner_job && (
                                   <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                     Partner
                                   </Badge>
                                 )}
                                 {order.scheduling_suppressed && (
                                   <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                                     Suppressed
                                   </Badge>
                                 )}
                               </div>
                             </div>
                           </TableCell>
                           <TableCell>
                             <Badge className={getStatusColor(order.status_enhanced)}>
                               {order.status_enhanced === 'awaiting_payment' ? 'Awaiting Payment' : 
                                order.status_enhanced === 'awaiting_install_booking' ? 'Awaiting Install Booking' :
                                formatStatus(order.status_enhanced)}
                             </Badge>
                           </TableCell>
                           <TableCell>
                             {order.is_partner_job ? (
                               <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700">
                                 {order.partner_status || 'Legacy Import'}
                               </Badge>
                             ) : (
                               <span className="text-muted-foreground text-sm">-</span>
                             )}
                           </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {order.engineer ? (
                                <span className="text-blue-600">{order.engineer.name}</span>
                              ) : (
                                <span className="text-muted-foreground">No engineer assigned</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">£{order.total_amount.toLocaleString()}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">£{order.amount_paid.toLocaleString()}</span>
                              {order.amount_paid < order.total_amount && (
                                <p className="text-xs text-red-600">
                                  Outstanding: £{(order.total_amount - order.amount_paid).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(order.created_at).toLocaleDateString('en-GB')}
                          </TableCell>
                          <TableCell>
                            {order.scheduled_install_date ? (
                              new Date(order.scheduled_install_date).toLocaleDateString('en-GB')
                            ) : (
                              <span className="text-muted-foreground">Not scheduled</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate(`/orders/${order.id}`)}
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
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Order</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete order {order.order_number}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteOrder(order.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                      disabled={deletingOrderId === order.id}
                                    >
                                      {deletingOrderId === order.id ? 'Deleting...' : 'Delete'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}
