
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Eye, Search, Filter, Calendar, User, Package, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type OrderStatusEnhanced = Database['public']['Enums']['order_status_enhanced'];

export default function AdminOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [engineerFilter, setEngineerFilter] = useState<string>("all");
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`https://qvppvstgconmzzjsryna.supabase.co/functions/v1/admin-delete-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ orderId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete order');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success("Order deleted successfully");
      setDeletingOrderId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete order: ${error.message}`);
      setDeletingOrderId(null);
    }
  });

  const handleDeleteOrder = (orderId: string) => {
    setDeletingOrderId(orderId);
  };

  const confirmDelete = () => {
    if (deletingOrderId) {
      deleteMutation.mutate(deletingOrderId);
    }
  };

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
        query = query.eq('status_enhanced', statusFilter as OrderStatusEnhanced);
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

  const getStatusClassName = (status: string) => {
    const classes: Record<string, string> = {
      'awaiting_payment': 'status-cancelled',
      'awaiting_agreement': 'status-pending',
      'awaiting_survey_submission': 'status-pending',
      'awaiting_survey_review': 'status-in_progress',
      'awaiting_install_booking': 'status-draft',
      'scheduled': 'status-scheduled',
      'in_progress': 'status-in_progress',
      'install_completed_pending_qa': 'status-accepted',
      'completed': 'status-completed',
    };
    return classes[status] || 'status-draft';
  };

  const formatStatusText = (status: string) => {
    const formatted = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const shortNames: Record<string, string> = {
      'Awaiting Survey Submission': 'Survey Needed',
      'Awaiting Survey Review': 'Survey Review',
      'Awaiting Install Booking': 'Ready to Book',
      'Install Completed Pending Qa': 'Pending QA',
    };
    return shortNames[formatted] || formatted;
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
    <div className="container mx-auto py-section space-y-lg">
      <div className="flex justify-between items-start">
        <div className="space-y-sm">
          <h1 className="brand-heading-1">Orders Management</h1>
          <p className="brand-small text-muted-foreground">
            Manage and track all orders in the system
          </p>
        </div>
        <div className="flex items-center gap-sm px-card py-compact bg-muted/50 rounded-lg">
          <Package className="icon-sm text-muted-foreground" />
          <span className="text-sm font-medium">{orders?.length || 0} Total Orders</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-md">
          <CardTitle className="flex items-center gap-sm text-lg font-semibold">
            <Filter className="icon-sm" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <div className="relative">
              <Search className="absolute left-3 top-3 icon-sm text-muted-foreground" />
              <Input
                placeholder="Search orders, clients, or quote numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
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
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-compact">
          <CardTitle className="brand-heading-3">Orders Overview</CardTitle>
          <CardDescription className="brand-small text-muted-foreground">
            All orders with their current status and details
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
               <TableHeader>
                 <TableRow className="border-b">
                   <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide py-2 h-9">Order</TableHead>
                   <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide py-2 h-9">Client</TableHead>
                   <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide py-2 h-9">Status</TableHead>
                   <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide py-2 h-9 hidden lg:table-cell">Engineer</TableHead>
                   <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide py-2 h-9">Scheduled</TableHead>
                   <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide py-2 h-9">Amount</TableHead>
                   <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide py-2 h-9 hidden xl:table-cell">Created</TableHead>
                   <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide py-2 h-9 text-right">Actions</TableHead>
                 </TableRow>
               </TableHeader>
              <TableBody>
                {orders?.map((order, index) => (
                  <TableRow key={order.id} className={`border-b hover:bg-muted/30 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                     <TableCell className="py-2 align-middle">
                       <div className="flex items-center gap-2">
                         <span className="text-sm font-medium text-foreground leading-none">{order.order_number}</span>
                         {order.quote?.quote_number && (
                           <span className="text-xs text-muted-foreground opacity-75">
                             Q{order.quote.quote_number.replace(/^Q/, '')}
                           </span>
                         )}
                         {order.is_partner_job && order.partner && (
                           <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0.5 h-4 leading-none bg-blue-50 text-blue-700 border-blue-200">
                             {order.partner.name}
                           </Badge>
                         )}
                       </div>
                     </TableCell>
                    <TableCell className="py-2 align-middle">
                      {order.client ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-foreground leading-none truncate">{order.client.full_name}</span>
                          <span className="text-xs text-muted-foreground opacity-75 truncate max-w-[120px]">{order.client.email}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No client</span>
                      )}
                    </TableCell>
                     <TableCell className="py-2 align-middle">
                       <Badge className={`text-[10px] font-medium uppercase px-2 py-0.5 h-5 leading-none ${getStatusClassName(order.status_enhanced || 'unknown')}`}>
                         {formatStatusText(order.status_enhanced || 'unknown')}
                       </Badge>
                     </TableCell>
                     <TableCell className="py-2 align-middle hidden lg:table-cell">
                       {order.engineer ? (
                         <div className="flex items-center gap-1.5">
                           <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                           <span className="text-xs font-medium text-foreground truncate leading-none">{order.engineer.name}</span>
                         </div>
                       ) : (
                         <span className="text-xs text-muted-foreground">Unassigned</span>
                       )}
                     </TableCell>
                     <TableCell className="py-2 align-middle">
                       {order.scheduled_install_date ? (
                         <div className="flex items-center gap-1.5">
                           <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                           <span className="text-xs font-medium text-foreground whitespace-nowrap leading-none">
                             {format(new Date(order.scheduled_install_date), 'd MMM yyyy')}
                           </span>
                         </div>
                       ) : (
                         <span className="text-xs text-muted-foreground">Not scheduled</span>
                       )}
                     </TableCell>
                    <TableCell className="py-2 align-middle">
                      <span className="text-sm font-semibold text-foreground leading-none">£{order.total_amount.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="py-2 align-middle hidden xl:table-cell">
                      <span className="text-xs text-muted-foreground whitespace-nowrap leading-none">
                        {format(new Date(order.created_at), 'd MMM yyyy')}
                      </span>
                    </TableCell>
                     <TableCell className="py-2 align-middle">
                       <div className="flex items-center justify-end gap-1">
                         <Button
                           variant="outline"
                           size="sm"
                           className="h-8 px-2 text-xs font-medium"
                           onClick={() => navigate(`/admin/orders/${order.id}`)}
                         >
                           <Eye className="h-4 w-4" />
                           <span className="ml-1 hidden sm:inline">View</span>
                         </Button>
                         <Button
                           variant="destructive"
                           size="sm"
                           className="h-8 px-2 text-xs font-medium"
                           onClick={() => handleDeleteOrder(order.id)}
                           disabled={deleteMutation.isPending}
                         >
                           <Trash2 className="h-4 w-4" />
                           <span className="ml-1 hidden sm:inline">Delete</span>
                         </Button>
                       </div>
                     </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {orders?.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No orders found</h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== 'all' || engineerFilter !== 'all'
                ? 'Try adjusting your search terms or filters.' 
                : 'Orders will appear here once quotes are accepted.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingOrderId} onOpenChange={() => setDeletingOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be undone and will permanently remove all associated data including payments, uploads, and activity history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
