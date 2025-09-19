import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, AlertTriangle, Package, Truck, CheckCircle } from 'lucide-react';
import { ChargerDispatchTable } from '@/components/admin/dispatch/ChargerDispatchTable';
import { ChargerDispatchFilters } from '@/components/admin/dispatch/ChargerDispatchFilters';
import { MarkAsDispatchedModal } from '@/components/admin/dispatch/MarkAsDispatchedModal';
import { useChargerDispatchData } from '@/hooks/useChargerDispatchData';
import { useServerPagination } from '@/hooks/useServerPagination';

export default function AdminChargerDispatch() {
  const { pagination, controls } = useServerPagination();
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    region: 'all',
    engineer: 'all',
    dispatchStatus: 'all',
    jobType: 'all'
  });
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  const { data, isLoading, error } = useChargerDispatchData({
    pagination,
    filters
  });

  const orders = data?.orders || [];
  const totalCount = data?.totalCount || 0;
  const stats = data?.stats || {
    pendingDispatch: 0,
    dispatched: 0,
    urgent: 0,
    issues: 0
  };

  const handleMarkAsDispatched = (orderId: string) => {
    setSelectedOrder(orderId);
    setShowDispatchModal(true);
  };

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    controls.resetToFirstPage();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Charger Dispatch Manager</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage EV charger dispatches for scheduled installations
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Dispatch</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingDispatch}</div>
            <p className="text-xs text-muted-foreground">
              Require charger dispatch
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispatched</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.dispatched}</div>
            <p className="text-xs text-muted-foreground">
              Chargers in transit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent (48h)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
            <p className="text-xs text-muted-foreground">
              Due within 2 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.issues}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <ChargerDispatchFilters 
        filters={filters}
        onFiltersChange={handleFilterChange}
      />

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Dispatch Queue</CardTitle>
              <CardDescription>
                {totalCount} jobs • Showing page {pagination.page} of {Math.ceil(totalCount / pagination.pageSize)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChargerDispatchTable
            orders={orders}
            isLoading={isLoading}
            onMarkAsDispatched={handleMarkAsDispatched}
            pagination={pagination}
            totalCount={totalCount}
            onPageChange={controls.setPage}
            onPageSizeChange={controls.setPageSize}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      <MarkAsDispatchedModal
        isOpen={showDispatchModal}
        onClose={() => {
          setShowDispatchModal(false);
          setSelectedOrder(null);
        }}
        orderId={selectedOrder}
      />
    </div>
  );
}