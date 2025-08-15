
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BrandPage, BrandContainer } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Eye } from 'lucide-react';
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
  // Optional field that might not exist in database
  engineer_status?: string;
  client: {
    id: string;
    full_name: string;
    email: string;
  };
  engineer?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match our interface, providing defaults for missing fields
      const transformedOrders: Order[] = (data || []).map(order => ({
        ...order,
        engineer_status: undefined, // This field doesn't exist in the database schema
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
      order.client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status_enhanced === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'awaiting_payment':
        return 'bg-red-100 text-red-800';
      case 'awaiting_agreement':
        return 'bg-orange-100 text-orange-800';
      case 'awaiting_install_booking':
        return 'bg-yellow-100 text-yellow-800';
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
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Orders</h1>
            <Button onClick={() => navigate('/admin/orders/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
                    <SelectItem value="awaiting_agreement">Awaiting Agreement</SelectItem>
                    <SelectItem value="awaiting_install_booking">Awaiting Booking</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="install_completed_pending_qa">Pending QA</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Orders List */}
          <div className="grid gap-4">
            {filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground">No orders found</p>
                </CardContent>
              </Card>
            ) : (
              filteredOrders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{order.order_number}</h3>
                          <Badge className={getStatusColor(order.status_enhanced)}>
                            {formatStatus(order.status_enhanced)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p><strong>Client:</strong> {order.client.full_name}</p>
                          <p><strong>Email:</strong> {order.client.email}</p>
                          {order.engineer && (
                            <p><strong>Engineer:</strong> {order.engineer.name}</p>
                          )}
                          <p><strong>Created:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
                          {order.scheduled_install_date && (
                            <p><strong>Scheduled:</strong> {new Date(order.scheduled_install_date).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:items-end gap-2">
                        <div className="text-right">
                          <p className="font-semibold text-lg">£{order.total_amount.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">
                            Paid: £{order.amount_paid.toLocaleString()}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/admin/order/${order.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}
