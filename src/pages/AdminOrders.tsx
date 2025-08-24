
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Search, Filter, Calendar, User, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export default function AdminOrders() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [engineerFilter, setEngineerFilter] = useState<string>("all");

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['admin-orders', searchTerm, statusFilter, engineerFilter],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          clients!orders_client_id_fkey(
            id,
            full_name,
            email,
            phone
          ),
          quotes!orders_quote_id_fkey(
            id,
            quote_number
          ),
          engineers!orders_engineer_id_fkey(
            id,
            name
          ),
          partners!orders_partner_id_fkey(
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status_enhanced', statusFilter);
      }

      if (engineerFilter !== 'all') {
        query = query.eq('engineer_id', engineerFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform and filter data
      let transformedData = data.map(order => ({
        ...order,
        client: order.clients || null,
        quote: order.quotes || null,
        engineer: order.engineers || null,
        partner: order.partners || null
      }));

      // Apply search filter
      if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        transformedData = transformedData.filter(order =>
          order.order_number?.toLowerCase().includes(lowerSearchTerm) ||
          order.client?.full_name?.toLowerCase().includes(lowerSearchTerm) ||
          order.client?.email?.toLowerCase().includes(lowerSearchTerm) ||
          order.quote?.quote_number?.toLowerCase().includes(lowerSearchTerm)
        );
      }

      return transformedData;
    },
  });

  const { data: engineers } = useQuery({
    queryKey: ['engineers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name')
        .eq('availability', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'awaiting_payment', label: 'Awaiting Payment' },
    { value: 'awaiting_agreement', label: 'Awaiting Agreement' },
    { value: 'awaiting_survey_submission', label: 'Awaiting Survey' },
    { value: 'awaiting_survey_review', label: 'Survey Review' },
    { value: 'awaiting_install_booking', label: 'Needs Scheduling' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'install_completed_pending_qa', label: 'Pending QA' },
    { value: 'completed', label: 'Completed' },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'awaiting_payment': 'bg-red-100 text-red-800',
      'awaiting_agreement': 'bg-orange-100 text-orange-800',
      'awaiting_survey_submission': 'bg-yellow-100 text-yellow-800',
      'awaiting_survey_review': 'bg-blue-100 text-blue-800',
      'awaiting_install_booking': 'bg-purple-100 text-purple-800',
      'scheduled': 'bg-indigo-100 text-indigo-800',
      'in_progress': 'bg-cyan-100 text-cyan-800',
      'install_completed_pending_qa': 'bg-lime-100 text-lime-800',
      'completed': 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Loading orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-600">
          Error loading orders: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Orders Management</h1>
          <p className="text-muted-foreground">
            Manage and track all orders in the system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <span className="font-medium">{orders?.length || 0} Total Orders</span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders, clients, or quote numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={engineerFilter} onValueChange={setEngineerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by engineer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Engineers</SelectItem>
                {engineers?.map((engineer) => (
                  <SelectItem key={engineer.id} value={engineer.id}>
                    {engineer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>
            All orders with their current status and details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Engineer</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.order_number}
                      {order.quote?.quote_number && (
                        <p className="text-sm text-muted-foreground">
                          Quote: {order.quote.quote_number}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.client ? (
                        <div>
                          <p className="font-medium">{order.client.full_name}</p>
                          <p className="text-sm text-muted-foreground">{order.client.email}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No client</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status_enhanced || 'unknown')}>
                        {order.status_enhanced?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.engineer ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {order.engineer.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.scheduled_install_date ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(order.scheduled_install_date), 'PPP')}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not scheduled</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      £{order.total_amount}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.created_at), 'PPP')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
