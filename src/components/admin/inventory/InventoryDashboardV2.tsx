import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  AlertTriangle, 
  ShoppingCart, 
  Clock, 
  Package2, 
  Truck, 
  CheckCircle, 
  TrendingDown,
  Plus,
  ArrowUpDown,
  FileText
} from 'lucide-react';
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { QuickActionsBlock } from './shared/QuickActionsBlock';
import { StatusChip } from './shared/StatusChip';
import { EnhancedStockTransferModal } from './EnhancedStockTransferModal';
import { LocationStockModal } from './LocationStockModal';
import { useInventoryEnhanced } from '@/hooks/useInventoryEnhanced';

interface InventoryDashboardV2Props {
  onSwitchTab: (tab: string) => void;
}

export function InventoryDashboardV2({ onSwitchTab }: InventoryDashboardV2Props) {
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  // Main KPI stats
  const { data: kpiStats, isLoading: kpiLoading } = useQuery({
    queryKey: ['inventory-kpi-stats'],
    queryFn: async () => {
      // Active Items (excluding chargers)
      const { data: itemsData } = await supabase
        .from('inventory_items')
        .select('id, is_active, reorder_point')
        .eq('is_active', true)
        .eq('is_charger', false);  // Exclude chargers

      // Get stock balances using consistent logic with pending/approved txns
      const { data: txnsData } = await supabase
        .from('inventory_txns')
        .select('item_id, location_id, direction, qty, status')
        .in('status', ['pending', 'approved']);
        
      // Calculate balances manually to match the low stock detection logic
      const balancesMap = new Map<string, { item_id: string; location_id: string; on_hand: number }>();
      
      txnsData?.forEach(txn => {
        const key = `${txn.item_id}-${txn.location_id}`;
        const current = balancesMap.get(key) || { item_id: txn.item_id, location_id: txn.location_id, on_hand: 0 };
        
        if (txn.direction === 'in' || txn.direction === 'adjust') {
          current.on_hand += txn.qty;
        } else {
          current.on_hand -= txn.qty;
        }
        
        balancesMap.set(key, current);
      });
      
      const balances = Array.from(balancesMap.values());

      // Stock requests by status
      const { data: requestsData } = await supabase
        .from('stock_requests')
        .select('status');

      // Calculate metrics
      const activeItems = itemsData?.length || 0;
      
      // Low stock calculation (simplified - items where any location is at/below reorder point)
      const lowStockItems = itemsData?.filter(item => {
        const itemBalances = balances?.filter(b => b.item_id === item.id) || [];
        return itemBalances.some(balance => balance.on_hand <= item.reorder_point);
      }).length || 0;

      // Stock request counts
      const requests = requestsData || [];
      const submittedRequests = requests.filter(r => r.status === 'submitted').length;
      const inPickRequests = requests.filter(r => r.status === 'in_pick').length;
      const inTransitRequests = requests.filter(r => r.status === 'in_transit').length;
      
      // Cancelled/Received today (updated to reflect new status meaning)
      const cancelledToday = requests.filter(r => r.status === 'cancelled').length;

      // Open POs (placeholder for now)
      const openPOs = 0;

      // Shrinkage 30d (placeholder calculation)
      const shrinkage = 2.3; // %

      return {
        activeItems,
        lowStockItems,
        openPOs,
        submittedRequests,
        inPickRequests,
        inTransitRequests,
        deliveredToday: cancelledToday,
        shrinkage
      };
    }
  });

  // Low stock engineer details for actual location-based low stock
  const { data: lowStockData } = useInventoryEnhanced().useLowStockEngineerDetails();

  // Recent stock requests for priority table
  const { data: recentRequests } = useQuery({
    queryKey: ['recent-stock-requests'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_requests')
        .select(`
          id, status, priority, needed_by, created_at,
          engineers(name),
          inventory_locations(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      
      return data || [];
    }
  });

  const quickActions = [
    {
      label: "New Stock Request",
      icon: Plus,
      onClick: () => onSwitchTab('requests'),
      variant: 'default' as const
    },
    {
      label: "Transfer Stock",
      icon: ArrowUpDown,
      onClick: () => setTransferModalOpen(true),
      variant: 'secondary' as const
    },
    {
      label: "Create Purchase Order",
      icon: FileText,
      onClick: () => onSwitchTab('purchase-orders'),
      variant: 'secondary' as const
    }
  ];

  if (kpiLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Inventory Overview</h2>
        <p className="text-muted-foreground">
          Monitor stock levels, requests, and operations at a glance
        </p>
      </div>

      {/* KPI Tiles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InventoryKpiTile
          title="Active Items"
          value={kpiStats?.activeItems || 0}
          icon={Package}
          variant="info"
          onClick={() => onSwitchTab('items')}
          subtitle="SKUs in inventory"
        />

        <InventoryKpiTile
          title="Low Stock"
          value={lowStockData?.length || 0}
          icon={AlertTriangle}
          variant={lowStockData?.length > 0 ? "warning" : "success"}
          onClick={() => onSwitchTab('items')}
          subtitle="Engineer locations low"
        />

        <InventoryKpiTile
          title="Open POs"
          value={kpiStats?.openPOs || 0}
          icon={ShoppingCart}
          variant="neutral"
          subtitle="Purchase orders"
        />

        <InventoryKpiTile
          title="Requests (Submitted)"
          value={kpiStats?.submittedRequests || 0}
          icon={Clock}
          variant={kpiStats?.submittedRequests > 0 ? "warning" : "neutral"}
          onClick={() => onSwitchTab('requests')}
          subtitle="Awaiting approval"
        />

        <InventoryKpiTile
          title="In Pick"
          value={kpiStats?.inPickRequests || 0}
          icon={Package2}
          variant="info"
          onClick={() => onSwitchTab('requests')}
          subtitle="Being prepared"
        />

        <InventoryKpiTile
          title="In Transit"
          value={kpiStats?.inTransitRequests || 0}
          icon={Truck}
          variant="info"
          onClick={() => onSwitchTab('requests')}
          subtitle="En route to engineers"
        />

        <InventoryKpiTile
          title="Delivered (Today)"
          value={kpiStats?.deliveredToday || 0}
          icon={CheckCircle}
          variant="success"
          subtitle="Completed today"
        />

        <InventoryKpiTile
          title="Shrinkage (30d)"
          value={kpiStats?.shrinkage || 0}
          icon={TrendingDown}
          variant={kpiStats?.shrinkage > 5 ? "danger" : "neutral"}
          subtitle="% of throughput"
          percentage={`${kpiStats?.shrinkage}%`}
        />
      </div>

      {/* Quick Actions */}
      <QuickActionsBlock actions={quickActions} />

      {/* Priority Tables */}
      <div className="space-y-6">
        {/* Low Stock Items Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Low Stock Items</CardTitle>
            <Button variant="outline" size="sm" onClick={() => onSwitchTab('items')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {lowStockData?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Engineer / Location</th>
                      <th className="text-left py-2 px-3 font-medium">Item</th>
                      <th className="text-left py-2 px-3 font-medium">SKU</th>
                      <th className="text-center py-2 px-3 font-medium">Current Stock</th>
                      <th className="text-center py-2 px-3 font-medium">Reorder Point</th>
                      <th className="text-center py-2 px-3 font-medium">Shortage</th>
                      <th className="text-center py-2 px-3 font-medium">Status</th>
                      <th className="text-right py-2 px-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockData.slice(0, 5).map((item: any) => (
                      <tr key={`${item.location_id}-${item.item_id}`} className="border-b hover:bg-muted/20">
                        <td className="py-2 px-3">
                          <div className="font-medium text-sm">{item.engineer_name}</div>
                          <div className="text-xs text-muted-foreground">{item.location_name}</div>
                        </td>
                        <td className="py-2 px-3 font-medium">{item.item_name}</td>
                        <td className="py-2 px-3 text-muted-foreground">{item.item_sku}</td>
                        <td className="py-2 px-3 text-center">{item.current_stock}</td>
                        <td className="py-2 px-3 text-center">{item.reorder_point}</td>
                        <td className="py-2 px-3 text-center text-red-600 font-medium">
                          {item.reorder_point - item.current_stock}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Low Stock
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => onSwitchTab('requests')}
                            >
                              Request Stock
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedLocation({
                                  id: item.location_id,
                                  name: item.location_name,
                                  type: 'engineer_van'
                                });
                                setLocationModalOpen(true);
                              }}
                            >
                              View Location
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No low stock locations
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Stock Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Recent Stock Requests</CardTitle>
            <Button variant="outline" size="sm" onClick={() => onSwitchTab('requests')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentRequests?.length ? (
              <div className="space-y-3">
                {recentRequests.map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{request.engineers?.name}</div>
                      <div className="text-xs text-muted-foreground">{request.inventory_locations?.name}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <StatusChip status={request.status as any}>
                        {request.status.replace('_', ' ')}
                      </StatusChip>
                      <div className="text-xs text-muted-foreground">
                        {request.priority} priority
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No recent requests
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <EnhancedStockTransferModal open={transferModalOpen} onOpenChange={setTransferModalOpen} />
      <LocationStockModal 
        open={locationModalOpen} 
        onOpenChange={setLocationModalOpen} 
        location={selectedLocation}
      />
    </div>
  );
}