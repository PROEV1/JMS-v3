
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EnhancedJobStatusBadge, type OrderStatusEnhanced as EnhancedOrderStatus } from "@/components/admin/EnhancedJobStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Eye, Search, Filter, Calendar, User, Package, Trash2, Download } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useServerPagination } from '@/hooks/useServerPagination';
import { Paginator } from '@/components/ui/Paginator';
import { keepPreviousData } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';

type OrderStatusEnhanced = Database['public']['Enums']['order_status_enhanced'];

export default function AdminOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // 300ms delay
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [engineerFilter, setEngineerFilter] = useState<string>("all");
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { pagination, controls } = useServerPagination();

  // Check if export is enabled via URL parameter
  const exportEnabled = searchParams.get('enableExport') === '1';

  // Reset to first page when filters change
  useEffect(() => {
    controls.resetToFirstPage();
  }, [debouncedSearchTerm, statusFilter, engineerFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-order', {
        body: { orderId }
      });

      if (error) {
        throw new Error(error.message || 'Failed to delete order');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to delete order');
      }

      return data;
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

  // Optimized search function that uses a single query with proper joins
  const buildSearchQuery = useMemo(() => {
    return (withPagination = true, withCount = true) => {
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
        `, withCount ? { count: 'exact' } : {})
        .order('created_at', { ascending: false });

      // Apply search filter using advanced text search
      if (debouncedSearchTerm) {
        const searchPattern = `%${debouncedSearchTerm}%`;
        query = query.or(`
          order_number.ilike.${searchPattern},
          partner_external_id.ilike.${searchPattern},
          job_address.ilike.${searchPattern},
          postcode.ilike.${searchPattern},
          clients.full_name.ilike.${searchPattern},
          clients.email.ilike.${searchPattern},
          clients.phone.ilike.${searchPattern},
          quotes.quote_number.ilike.${searchPattern},
          partners.name.ilike.${searchPattern}
        `);
      }

      // Apply other filters
      if (statusFilter !== 'all') {
        query = query.eq('status_enhanced', statusFilter as OrderStatusEnhanced);
      }

      if (engineerFilter !== 'all') {
        query = query.eq('engineer_id', engineerFilter);
      }

      // Apply pagination if requested
      if (withPagination) {
        query = query.range(pagination.offset, pagination.offset + pagination.pageSize - 1);
      }

      return query;
    };
  }, [debouncedSearchTerm, statusFilter, engineerFilter, pagination.offset, pagination.pageSize]);

  const { data: ordersResponse, isLoading, error } = useQuery({
    queryKey: ['admin-orders', pagination.page, pagination.pageSize, debouncedSearchTerm, statusFilter, engineerFilter],
    queryFn: async () => {
      try {
        const query = buildSearchQuery(true, true);
        const { data, error, count } = await query;
        
        if (error) throw error;

        // Transform data
        const transformedData = data?.map(order => ({
          ...order,
          client: order.clients || null,
          quote: order.quotes || null,
          engineer: order.engineers || null,
          partner: order.partners || null
        })) || [];

        return { data: transformedData, count: count || 0 };
      } catch (error) {
        console.error('Orders query error:', error);
        throw error;
      }
    },
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: 1000,
  });

  const orders = ordersResponse?.data || [];
  const totalCount = ordersResponse?.count || 0;

  const { data: engineers } = useQuery({
    queryKey: ['engineers-list'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('engineers')
          .select('id, name')
          .eq('availability', true)
          .order('name');
        
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Engineers query error:', error);
        throw error;
      }
    },
    retry: 2,
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
    { value: 'on_hold_parts_docs', label: 'On Hold - Parts/Docs' },
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

  const csvEscape = (value: any): string => {
    if (value == null) return '';
    const str = String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Simplified export functionality
  const handleExportCSV = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      // Build query without pagination for export
      const exportQuery = buildSearchQuery(false, false);
      
      // Fetch data in batches (max 10,000 total)
      const batchSize = 1000;
      const maxRecords = 10000;
      let allOrders: any[] = [];
      let offset = 0;

      while (offset < maxRecords) {
        const { data: batch, error } = await exportQuery
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!batch || batch.length === 0) break;

        allOrders.push(...batch);
        offset += batchSize;

        // Stop if we got less than batch size (end of data)
        if (batch.length < batchSize) break;
      }

      if (allOrders.length === 0) {
        toast.warning("No orders found to export");
        return;
      }

      // Generate CSV
      const headers = [
        'Order ID',
        'Order Number', 
        'Client Name',
        'Client Email',
        'Client Phone',
        'Status',
        'Engineer',
        'Scheduled Date',
        'Total Amount',
        'Amount Paid',
        'Created Date',
        'Quote Number',
        'Partner',
        'Job Address',
        'Postcode'
      ];

      const csvContent = [
        headers.join(','),
        ...allOrders.map(order => [
          csvEscape(order.id),
          csvEscape(order.order_number),
          csvEscape(order.clients?.full_name),
          csvEscape(order.clients?.email),
          csvEscape(order.clients?.phone),
          csvEscape(formatStatusText(order.status_enhanced || '')),
          csvEscape(order.engineers?.name),
          csvEscape(order.scheduled_install_date ? format(new Date(order.scheduled_install_date), 'yyyy-MM-dd') : ''),
          csvEscape(order.total_amount),
          csvEscape(order.amount_paid),
          csvEscape(order.created_at ? format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss') : ''),
          csvEscape(order.quotes?.quote_number),
          csvEscape(order.partners?.name),
          csvEscape(order.job_address),
          csvEscape(order.postcode)
        ].join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `orders-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
      link.click();

      toast.success(`Exported ${allOrders.length} orders to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export orders');
    } finally {
      setIsExporting(false);
    }
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
        <div className="flex items-center gap-3">
          {exportEnabled && (
            <Button 
              onClick={handleExportCSV}
              disabled={isExporting}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          )}
          <div className="flex items-center gap-sm px-card py-compact bg-muted/50 rounded-lg">
            <Package className="icon-sm text-muted-foreground" />
            <span className="text-sm font-medium">{totalCount} Total Orders</span>
          </div>
        </div>
      </div>

      {/* Unified Filter Bar */}
      <Card className="border border-border shadow-sm rounded-lg">
        <CardContent className="px-6 py-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Left: Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders, clients, or quote numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 text-sm"
              />
            </div>
            
            {/* Right: Filters */}
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 h-10 text-sm">
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
                <SelectTrigger className="w-48 h-10 text-sm">
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
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border border-border shadow-sm rounded-lg">
        <CardContent className="px-6 py-0">
          <div className="overflow-x-auto">
            <Table>
               <TableHeader>
                 <TableRow className="border-b border-border hover:bg-transparent">
                   <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto">Order</TableHead>
                   <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto">Client</TableHead>
                   <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto">Status</TableHead>
                   <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto hidden lg:table-cell">Engineer</TableHead>
                   <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto">Scheduled</TableHead>
                   <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto">Amount</TableHead>
                   <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto hidden xl:table-cell">Created</TableHead>
                   <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-4 h-auto text-right">Actions</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {orders?.map((order, index) => (
                   <TableRow key={order.id} className="border-b border-border hover:bg-muted/50 transition-colors h-16">
                      <TableCell className="py-4 align-middle">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground leading-none truncate">{order.order_number}</span>
                          {order.quote?.quote_number && (
                            <span className="text-xs text-muted-foreground">
                              Q{order.quote.quote_number.replace(/^Q/, '')}
                            </span>
                          )}
                          {order.is_partner_job && order.partner && (
                            <Badge variant="secondary" className="text-xs font-semibold uppercase px-2 py-1 bg-blue-50 text-blue-700 border-blue-200">
                              {order.partner.name}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                     <TableCell className="py-4 align-middle">
                       {order.client ? (
                         <div className="space-y-1">
                           <div className="text-sm font-medium text-foreground leading-none truncate">{order.client.full_name}</div>
                           <div className="text-xs text-muted-foreground truncate">{order.client.email}</div>
                         </div>
                       ) : (
                         <span className="text-xs text-muted-foreground">No client</span>
                       )}
                     </TableCell>
                       <TableCell className="py-4 align-middle">
                         <EnhancedJobStatusBadge 
                           status={order.status_enhanced as EnhancedOrderStatus}
                           className="text-xs"
                         />
                       </TableCell>
                      <TableCell className="py-4 align-middle hidden lg:table-cell">
                        {order.engineer ? (
                          <div className="flex items-center gap-1.5">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium text-foreground truncate">{order.engineer.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        {order.scheduled_install_date ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium text-foreground whitespace-nowrap">
                              {format(new Date(order.scheduled_install_date), 'd MMM yyyy')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not scheduled</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        <span className="text-sm font-semibold text-foreground">
                          {order.total_amount !== null ? `£${order.total_amount.toLocaleString()}` : '—'}
                        </span>
                      </TableCell>
                     <TableCell className="py-4 align-middle hidden xl:table-cell">
                       <span className="text-xs text-muted-foreground whitespace-nowrap">
                         {format(new Date(order.created_at), 'd MMM yyyy')}
                       </span>
                     </TableCell>
                      <TableCell className="py-4 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs font-medium"
                            onClick={() => navigate(`/admin/orders/${order.id}`)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 px-3 text-xs font-medium"
                            onClick={() => handleDeleteOrder(order.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
            </Table>
          </div>
          
          <Paginator
            currentPage={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={totalCount}
            onPageChange={controls.setPage}
            onPageSizeChange={controls.setPageSize}
          />
        </CardContent>
      </Card>

      {/* Empty State */}
      {orders?.length === 0 && totalCount === 0 && (
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
