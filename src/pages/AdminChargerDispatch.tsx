import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Truck, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  BarChart3,
  Settings,
  Smartphone,
  Monitor,
  Wifi,
  WifiOff
} from 'lucide-react';
import { ChargerDispatchTable } from '@/components/admin/dispatch/ChargerDispatchTable';
import { ChargerDispatchFilters } from '@/components/admin/dispatch/ChargerDispatchFilters';
import { AdvancedDispatchFilters } from '@/components/admin/dispatch/AdvancedDispatchFilters';
import { BulkActionsBar } from '@/components/admin/dispatch/BulkActionsBar';
import { MarkAsDispatchedModal } from '@/components/admin/dispatch/MarkAsDispatchedModal';
import { FlagIssueModal } from '@/components/admin/dispatch/FlagIssueModal';
import { DispatchAnalytics } from '@/components/admin/dispatch/DispatchAnalytics';
import { MobileDispatchView } from '@/components/admin/dispatch/MobileDispatchView';
import { DispatchRealtimeProvider, useDispatchRealtime } from '@/components/admin/dispatch/DispatchRealtimeProvider';
import { useChargerDispatchData } from '@/hooks/useChargerDispatchData';
import { useServerPagination } from '@/hooks/useServerPagination';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

function AdminChargerDispatchContent() {
  const { toast } = useToast();
  const { isConnected, enableRealtime, disableRealtime } = useDispatchRealtime();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [currentTab, setCurrentTab] = useState('overview');

  const { pagination, controls } = useServerPagination();
  const { setPage, setPageSize, resetToFirstPage } = controls;
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    region: 'all',
    engineer: 'all',
    dispatchStatus: 'all',
    jobType: 'all'
  });

  const { data, isLoading, refetch } = useChargerDispatchData({
    pagination,
    filters
  });

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Clean up realtime connection on unmount only
  useEffect(() => {
    return () => {
      if (isConnected) {
        disableRealtime();
      }
    };
  }, []);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    resetToFirstPage();
  };

  const handleMarkDispatched = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowDispatchModal(true);
  };

  const handleFlagIssue = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowIssueModal(true);
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      // Map frontend status to database status
      const dbStatus = status === 'dispatched' ? 'sent' : status;
      
      const { error } = await supabase
        .from('charger_dispatches')
        .upsert(
          selectedOrders.map(orderId => ({
            order_id: orderId,
            charger_item_id: 'default-charger-id', // This should be dynamic in production
            status: dbStatus,
            updated_at: new Date().toISOString(),
            ...(dbStatus === 'sent' && { dispatched_at: new Date().toISOString() })
          }))
        );

      if (error) throw error;

      toast({
        title: "Success",
        description: `Updated ${selectedOrders.length} orders to ${status}`,
      });

      setSelectedOrders([]);
      refetch();
    } catch (error) {
      console.error('Error updating orders:', error);
      toast({
        title: "Error",
        description: "Failed to update orders",
        variant: "destructive",
      });
    }
  };

  const handleAdvancedFilterApply = (advancedFilters: any) => {
    // Convert advanced filters to standard filters format
    setFilters({
      ...filters,
      dateFrom: advancedFilters.dateRange === 'custom' ? advancedFilters.customDateFrom : '',
      dateTo: advancedFilters.dateRange === 'custom' ? advancedFilters.customDateTo : '',
      // Add more advanced filter mappings as needed
    });
    resetToFirstPage();
  };

  const handleExportData = async (exportFilters: any) => {
    try {
      const { data: exportData } = await supabase
        .from('orders')
        .select(`
          order_number,
          scheduled_install_date,
          status_enhanced,
          job_type,
          clients!inner (
            full_name,
            postcode,
            address,
            phone
          ),
          engineers (
            name,
            region
          ),
          charger_dispatches (
            status,
            dispatched_at,
            delivered_at,
            tracking_number
          )
        `)
        .not('scheduled_install_date', 'is', null);

      if (exportData) {
        const csvContent = [
          ['Order Number', 'Client Name', 'Postcode', 'Install Date', 'Engineer', 'Dispatch Status', 'Dispatched At'],
          ...exportData.map(order => [
            order.order_number,
            order.clients?.full_name || '',
            order.clients?.postcode || '',
            order.scheduled_install_date,
            order.engineers?.name || '',
            order.charger_dispatches?.[0]?.status || 'pending',
            order.charger_dispatches?.[0]?.dispatched_at || ''
          ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dispatch-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      toast({
        title: "Export Complete",
        description: "Dispatch data exported successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export dispatch data",
        variant: "destructive",
      });
    }
  };

  const handleModalSuccess = () => {
    setSelectedOrders([]);
    setSelectedOrderId(null);
    refetch();
  };

  if (isMobileView) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex justify-between items-center p-4 border-b bg-background">
          <div>
            <h1 className="text-xl font-bold">Dispatch Manager</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                {isConnected ? <Wifi className="h-3 w-3 text-green-500" /> : <WifiOff className="h-3 w-3 text-red-500" />}
                <span>{isConnected ? 'Live' : 'Offline'}</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileView(false)}
          >
            <Monitor className="h-4 w-4" />
          </Button>
        </div>

        <MobileDispatchView
          orders={data?.orders?.map(order => ({
            id: order.id,
            order_number: order.order_number,
            client_name: order.clients?.full_name || '',
            postcode: order.clients?.postcode || '',
            phone: order.clients?.phone || '',
            scheduled_install_date: order.scheduled_install_date,
            engineer_name: order.engineers?.name || 'Unassigned',
            dispatch_status: order.dispatch_status,
            urgency_level: order.urgency_level,
            days_until_install: order.days_until_install,
            job_type: order.job_type || ''
          })) || []}
          isLoading={isLoading}
          onMarkDispatched={handleMarkDispatched}
          onFlagIssue={handleFlagIssue}
          onRefresh={refetch}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Charger Dispatch Manager</h1>
          <p className="text-muted-foreground">Track and manage EV charger dispatches</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            {isConnected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
            <span className="text-muted-foreground">{isConnected ? 'Live Updates' : 'Offline'}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileView(true)}
            className="md:hidden"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={isConnected ? disableRealtime : enableRealtime}
          >
            {isConnected ? <WifiOff className="h-4 w-4 mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
            {isConnected ? 'Disable Live' : 'Enable Live'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Dispatch</p>
                <p className="text-2xl font-bold">{data?.stats.pendingDispatch || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dispatched</p>
                <p className="text-2xl font-bold">{data?.stats.dispatched || 0}</p>
              </div>
              <Truck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Urgent</p>
                <p className="text-2xl font-bold">{data?.stats.urgent || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Issues</p>
                <p className="text-2xl font-bold">{data?.stats.issues || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Filters */}
          <ChargerDispatchFilters 
            filters={filters} 
            onFiltersChange={handleFilterChange} 
          />

          {/* Bulk Actions */}
          <BulkActionsBar
            selectedCount={selectedOrders.length}
            onClearSelection={() => setSelectedOrders([])}
            onBulkDispatch={() => setShowDispatchModal(true)}
            onBulkFlagIssue={() => setShowIssueModal(true)}
            onBulkStatusChange={handleBulkStatusChange}
          />

          {/* Dispatch Table */}
          <ChargerDispatchTable
            orders={data?.orders || []}
            isLoading={isLoading}
            totalCount={data?.totalCount || 0}
            pagination={pagination}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            selectedOrders={selectedOrders}
            onSelectionChange={setSelectedOrders}
            onMarkAsDispatched={handleMarkDispatched}
            onFlagIssue={handleFlagIssue}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <DispatchAnalytics 
            dateRange={{ 
              from: filters.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              to: filters.dateTo || new Date().toISOString().split('T')[0]
            }}
          />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <AdvancedDispatchFilters
            onApplyFilters={handleAdvancedFilterApply}
            onExportData={handleExportData}
          />
          
          {/* Advanced table view */}
          <ChargerDispatchTable
            orders={data?.orders || []}
            isLoading={isLoading}
            totalCount={data?.totalCount || 0}
            pagination={pagination}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            selectedOrders={selectedOrders}
            onSelectionChange={setSelectedOrders}
            onMarkAsDispatched={handleMarkDispatched}
            onFlagIssue={handleFlagIssue}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <MarkAsDispatchedModal
        isOpen={showDispatchModal}
        onClose={() => {
          setShowDispatchModal(false);
          setSelectedOrderId(null);
        }}
        orderId={selectedOrderId || (selectedOrders.length === 1 ? selectedOrders[0] : null)}
      />

      <FlagIssueModal
        isOpen={showIssueModal}
        onClose={() => {
          setShowIssueModal(false);
          setSelectedOrderId(null);
        }}
        orderId={selectedOrderId || (selectedOrders.length === 1 ? selectedOrders[0] : null)}
      />
    </div>
  );
}

export default function AdminChargerDispatch() {
  return (
    <DispatchRealtimeProvider>
      <AdminChargerDispatchContent />
    </DispatchRealtimeProvider>
  );
}