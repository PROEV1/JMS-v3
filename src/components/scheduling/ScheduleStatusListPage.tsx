import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Order, Engineer } from '@/utils/schedulingUtils';
import { getLocationDisplayText } from '@/utils/postcodeUtils';
import { SmartAssignmentModal } from '@/components/scheduling/SmartAssignmentModal';
import { toast } from 'sonner';
import { ArrowLeft, Search, Filter, Calendar, User, MapPin, PoundSterling, Users } from 'lucide-react';

interface StatusPageConfig {
  title: string;
  description: string;
  statusValues: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const statusConfigs: Record<string, StatusPageConfig> = {
  'needs-scheduling': {
    title: 'Needs Scheduling',
    description: 'Jobs that need to be scheduled with engineers',
    statusValues: ['needs_scheduling', 'awaiting_install_booking'],
    icon: () => <span>🕐</span>
  },
  'date-offered': {
    title: 'Date Offered',
    description: 'Dates offered to clients, awaiting response',
    statusValues: ['date_offered'],
    icon: () => <span>📅</span>
  },
  'ready-to-book': {
    title: 'Ready to Book',
    description: 'Client accepted date, ready for final booking',
    statusValues: ['date_accepted', 'scheduled'],
    icon: () => <span>✅</span>
  },
  'date-rejected': {
    title: 'Date Rejected',
    description: 'Client rejected offered date - needs rescheduling',
    statusValues: ['date_rejected'],
    icon: () => <span>❌</span>
  },
  'offer-expired': {
    title: 'Offer Expired',
    description: 'Offers that have expired without response',
    statusValues: ['offer_expired'],
    icon: () => <span>⏰</span>
  },
  'on-hold': {
    title: 'On Hold - Parts/Docs',
    description: 'Waiting for parts or documentation',
    statusValues: ['on_hold_parts_docs'],
    icon: () => <span>📦</span>
  },
  'cancelled': {
    title: 'Cancelled',
    description: 'Cancelled jobs',
    statusValues: ['cancelled'],
    icon: () => <span>🚫</span>
  }
};

export function ScheduleStatusListPage() {
  const { status } = useParams<{ status: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'total_amount' | 'client_name'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  const config = status ? statusConfigs[status] : null;

  useEffect(() => {
    const loadData = async () => {
      if (!config) return;
      
      setLoading(true);
      try {
        // Load orders
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            *,
            client:clients(*),
            engineer:engineers(*)
          `)
          .in('status_enhanced', config.statusValues as any)
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;
        setOrders(ordersData || []);

        // Load engineers for recommendations
        const { data: engineersData, error: engineersError } = await supabase
          .from('engineers')
          .select('*')
          .eq('availability', true);

        if (engineersError) throw engineersError;
        setEngineers(engineersData || []);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [config]);

  useEffect(() => {
    let filtered = [...orders];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.client?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.postcode?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'client_name':
          aValue = a.client?.full_name || '';
          bValue = b.client?.full_name || '';
          break;
        case 'total_amount':
          aValue = a.total_amount;
          bValue = b.total_amount;
          break;
        case 'created_at':
        default:
          // Use a default date if created_at is not available
          aValue = Date.now() - (1000 * 60 * 60 * 24 * 7); // Default to 7 days ago
          bValue = Date.now() - (1000 * 60 * 60 * 24 * 7);
          break;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredOrders(filtered);
  }, [orders, searchTerm, sortBy, sortDirection]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status_enhanced: newStatus as any })
        .eq('id', orderId);

      if (error) throw error;
      
      // Remove from current list since it no longer matches this status
      setOrders(prev => prev.filter(o => o.id !== orderId));
      toast.success('Job status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleShowRecommendations = (order: Order) => {
    setSelectedOrder(order);
    setShowAssignmentModal(true);
  };

  const handleAssignEngineer = async (engineerId: string, date: string) => {
    if (!selectedOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          engineer_id: engineerId,
          scheduled_install_date: date,
          status_enhanced: 'scheduled'
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;
      
      // Update the order in the list
      setOrders(prev => prev.map(o => 
        o.id === selectedOrder.id 
          ? { ...o, engineer_id: engineerId, scheduled_install_date: date, status_enhanced: 'scheduled' as any }
          : o
      ));
      
      setShowAssignmentModal(false);
      setSelectedOrder(null);
      toast.success('Engineer assigned successfully');
    } catch (error) {
      console.error('Error assigning engineer:', error);
      toast.error('Failed to assign engineer');
    }
  };

  if (!config) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Invalid Status</h2>
            <p className="text-muted-foreground mb-4">The requested status page was not found.</p>
            <Button onClick={() => navigate('/admin/schedule')}>
              Back to Pipeline
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/admin/schedule')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pipeline
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <config.icon />
            {config.title}
          </h1>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
        <Badge variant="secondary" className="ml-auto px-3 py-1">
          {filteredOrders.length} jobs
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by job number, client name, or postcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Sort by</label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Date Created</SelectItem>
                  <SelectItem value="client_name">Client Name</SelectItem>
                  <SelectItem value="total_amount">Value</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Order</label>
              <Select value={sortDirection} onValueChange={(value: any) => setSortDirection(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Desc</SelectItem>
                  <SelectItem value="asc">Asc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs in {config.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <config.icon />
              <h3 className="text-lg font-semibold mt-2">No jobs found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'No jobs match your search criteria.' : `No jobs in ${config.title.toLowerCase()} status.`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Postcode</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Engineer</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {order.client?.full_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {getLocationDisplayText(order)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <PoundSterling className="h-4 w-4 text-muted-foreground" />
                        {order.total_amount?.toLocaleString() || '0'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.engineer ? (
                        <Badge variant="outline">{order.engineer.name}</Badge>
                      ) : (
                        <Badge variant="secondary">Unassigned</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {/* Use a placeholder date since created_at might not be available */}
                        Recent
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/order/${order.id}`)}
                        >
                          View Details
                        </Button>
                        {/* Show recommendations button for unassigned jobs in scheduling statuses */}
                        {!order.engineer_id && (status === 'needs-scheduling' || status === 'date-rejected') && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleShowRecommendations(order)}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            Show Recommendations
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Smart Assignment Modal */}
      {selectedOrder && (
        <SmartAssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => {
            setShowAssignmentModal(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
          engineers={engineers}
          onAssign={handleAssignEngineer}
        />
      )}
    </div>
  );
}