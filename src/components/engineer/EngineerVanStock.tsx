import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Package, 
  Scan,
  Plus,
  ArrowUpDown,
  TrendingUp,
  Clock,
  Wrench
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { InventoryKpiTile } from '../admin/inventory/shared/InventoryKpiTile';
import { StatusChip } from '../admin/inventory/shared/StatusChip';
import { EmptyState } from '../admin/inventory/shared/EmptyState';
import { EngineerPurchaseOrders } from './EngineerPurchaseOrders';
import { StockRequestButton } from './StockRequestButton';
import { EngineerScanModal } from './EngineerScanModal';
import { EngineerReturnModal } from './EngineerReturnModal';
import { UseMaterialsModal } from './UseMaterialsModal';
import { ChargerScanModal } from './ChargerScanModal';

export function EngineerVanStock() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showUseMaterialsModal, setShowUseMaterialsModal] = useState(false);
  const [showChargerScanModal, setShowChargerScanModal] = useState(false);
  const [chargerTypeFilter, setChargerTypeFilter] = useState<string>('all');

  // Get engineer's van location
  const { data: engineer } = useQuery({
    queryKey: ['engineer-profile'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;

      console.log('👤 GETTING ENGINEER PROFILE for user:', user.user.id);
      
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name')
        .eq('user_id', user.user.id)
        .maybeSingle();

      console.log('👤 ENGINEER PROFILE RESULT:', data, error);
      return data;
    }
  });

  // Get van location (assuming van locations are named after engineers)
  const { data: vanLocation } = useQuery({
    queryKey: ['van-location', engineer?.id],
    queryFn: async () => {
      if (!engineer) return null;

      console.log('🚐 GETTING VAN LOCATION for engineer:', engineer);
      
      // First try with engineer_id for exact match
      let { data } = await supabase
        .from('inventory_locations')
        .select('id, name')
        .eq('engineer_id', engineer.id)
        .eq('is_active', true)
        .maybeSingle();

      console.log('🚐 VAN LOCATION BY ENGINEER_ID:', data);
      
      // If not found, try by name pattern
      if (!data) {
        ({ data } = await supabase
          .from('inventory_locations')
          .select('id, name')
          .eq('type', 'van')
          .ilike('name', `%${engineer.name}%`)
          .eq('is_active', true)
          .maybeSingle());
        
        console.log('🚐 VAN LOCATION BY NAME PATTERN:', data);
      }

      return data;
    },
    enabled: !!engineer
  });

  // Get van stock metrics
  const { data: metrics } = useQuery({
    queryKey: ['van-stock-metrics', vanLocation?.id],
    queryFn: async () => {
      if (!vanLocation?.id) return { totalItems: 0, lowStock: 0, recentMovements: 0 };

      // Get stock balances
      const { data: balances } = await supabase.rpc('get_item_location_balances');
      const vanBalances = balances?.filter(b => b.location_id === vanLocation.id) || [];

      // Get recent movements (last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: movements } = await supabase
        .from('inventory_txns')
        .select('id')
        .eq('location_id', vanLocation.id)
        .gte('created_at', weekAgo);

      return {
        totalItems: vanBalances.filter(b => b.on_hand > 0).length,
        lowStock: 0, // TODO: Implement low stock logic for vans
        recentMovements: movements?.length || 0
      };
    },
    enabled: !!vanLocation?.id
  });

  // Get regular inventory items
  const { data: regularItems, isLoading: regularItemsLoading } = useQuery({
    queryKey: ['van-regular-items', vanLocation?.id, searchQuery],
    queryFn: async () => {
      if (!vanLocation?.id) return [];

      // Get regular inventory stock balances
      const { data: balances } = await supabase.rpc('get_item_location_balances');
      const vanBalances = balances?.filter(b => b.location_id === vanLocation.id && b.on_hand > 0) || [];

      if (vanBalances.length === 0) return [];

      // Get regular item details
      const itemIds = vanBalances.map(b => b.item_id);
      let query = supabase
        .from('inventory_items')
        .select('id, name, sku, unit')
        .in('id', itemIds);

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%`);
      }

      const { data: items } = await query;

      // Combine regular items with balances
      return items?.map(item => ({
        ...item,
        on_hand: vanBalances.find(b => b.item_id === item.id)?.on_hand || 0,
        type: 'regular'
      })) || [];
    },
    enabled: !!vanLocation?.id
  });

  // Get assigned chargers for this engineer
  const { data: assignedChargers, isLoading: chargersLoading } = useQuery({
    queryKey: ['van-assigned-chargers', engineer?.id, searchQuery, chargerTypeFilter],
    queryFn: async () => {
      if (!engineer?.id) return [];

      let chargerQuery = supabase
        .from('charger_inventory')
        .select(`
          id,
          serial_number,
          status,
          assigned_order_id,
          inventory_items!charger_item_id(id, name, sku)
        `)
        .eq('engineer_id', engineer.id)
        .in('status', ['assigned', 'dispatched', 'delivered']);

      const { data: chargers } = await chargerQuery;

      if (!chargers?.length) return [];

      let filteredChargers = chargers;

      // Apply charger type filter
      if (chargerTypeFilter !== 'all') {
        filteredChargers = chargers.filter(charger => 
          charger.inventory_items?.name?.toLowerCase().includes(chargerTypeFilter.toLowerCase())
        );
      }

      // Apply search filter
      if (searchQuery) {
        filteredChargers = filteredChargers.filter(charger => 
          charger.inventory_items?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          charger.serial_number.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Get order details for assigned chargers
      const orderIds = filteredChargers
        .filter(c => c.assigned_order_id)
        .map(c => c.assigned_order_id);
      
      let orderDetails = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            clients!inner(full_name)
          `)
          .in('id', orderIds);

        orderDetails = orders?.reduce((acc, order) => ({
          ...acc,
          [order.id]: order
        }), {}) || {};
      }

      return filteredChargers.map(charger => ({
        ...charger,
        charger_type: charger.inventory_items?.name || 'Unknown',
        order_details: charger.assigned_order_id ? orderDetails[charger.assigned_order_id] : null
      }));
    },
    enabled: !!engineer?.id
  });

  const isLoading = regularItemsLoading || chargersLoading;

  // Get recent transactions
  const { data: recentTransactions } = useQuery({
    queryKey: ['van-recent-transactions', vanLocation?.id],
    queryFn: async () => {
      if (!vanLocation?.id) return [];

      const { data } = await supabase
        .from('inventory_txns')
        .select(`
          id, direction, qty, reference, created_at,
          inventory_items(name, sku)
        `)
        .eq('location_id', vanLocation.id)
        .order('created_at', { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!vanLocation?.id
  });

  if (!engineer) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!vanLocation) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Van Stock</h1>
          <p className="text-muted-foreground">Your mobile inventory</p>
        </div>
        
        <EmptyState
          icon={Package}
          title="No Van Location Found"
          description="Contact your admin to set up your van location in the inventory system"
          actionLabel="Contact Admin"
          onAction={() => {/* TODO: Contact admin action */}}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Van Stock</h1>
        <p className="text-muted-foreground">
          {vanLocation.name} • Your mobile inventory
        </p>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <InventoryKpiTile
          title="Items on Hand"
          value={(regularItems?.length || 0)}
          icon={Package}
          variant="info"
          subtitle="Regular items"
        />
        
        <InventoryKpiTile
          title="Assigned Chargers"
          value={assignedChargers?.length || 0}
          icon={Wrench}
          variant="success"
          subtitle="Ready to install"
        />
        
        <InventoryKpiTile
          title="Recent Movements"
          value={metrics?.recentMovements || 0}
          icon={TrendingUp}
          variant="neutral"
          subtitle="Last 7 days"
        />
        
        <InventoryKpiTile
          title="Low Stock Items"
          value={metrics?.lowStock || 0}
          icon={Clock}
          variant={metrics?.lowStock > 0 ? "warning" : "success"}
          subtitle="Need restocking"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 flex-wrap">
        {engineer && (
          <StockRequestButton 
            engineerId={engineer.id}
            variant="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Request Stock
          </StockRequestButton>
        )}
        <Button variant="secondary" onClick={() => setShowScanModal(true)}>
          <Scan className="h-4 w-4 mr-2" />
          Scan Item
        </Button>
        <Button variant="secondary" onClick={() => setShowChargerScanModal(true)}>
          <Scan className="h-4 w-4 mr-2" />
          Scan Charger
        </Button>
        <Button variant="secondary" onClick={() => setShowUseMaterialsModal(true)}>
          <Wrench className="h-4 w-4 mr-2" />
          Use Materials
        </Button>
        <Button variant="secondary" onClick={() => setShowReturnModal(true)}>
          <ArrowUpDown className="h-4 w-4 mr-2" />
          Return Stock
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search items and chargers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <select
          value={chargerTypeFilter}
          onChange={(e) => setChargerTypeFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-background"
        >
          <option value="all">All Chargers</option>
          <option value="easee">Easee 7KW</option>
          <option value="epod">EPOD</option>
          <option value="ohme epod">Ohme ePod</option>
          <option value="ohme home pro 5m">Ohme Home Pro 5m</option>
          <option value="ohme home pro 8m">Ohme Home Pro 8m</option>
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Regular Stock Items */}
        <Card>
          <CardHeader>
            <CardTitle>Current Stock</CardTitle>
          </CardHeader>
          <CardContent>
            {regularItemsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : regularItems?.length > 0 ? (
              <div className="space-y-3">
                {regularItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{item.on_hand} {item.unit}</div>
                      <Badge variant="outline" className="text-xs">In Stock</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                {searchQuery ? 'No items found' : 'No regular stock items'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Chargers */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned Chargers</CardTitle>
          </CardHeader>
          <CardContent>
            {chargersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : assignedChargers?.length > 0 ? (
              <div className="space-y-3">
                {assignedChargers.map((charger) => (
                  <div key={charger.id} className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-start justify-between mb-2">
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{charger.charger_type}</div>
                        <div className="text-xs text-muted-foreground">
                          Serial: {charger.serial_number}
                        </div>
                        {charger.order_details && (
                          <div className="text-xs text-blue-600">
                            Order: {charger.order_details.order_number} - {charger.order_details.clients?.full_name}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={charger.status === 'delivered' ? 'default' : 
                                  charger.status === 'assigned' ? 'secondary' : 'outline'} 
                          className="text-xs"
                        >
                          {charger.status.charAt(0).toUpperCase() + charger.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => setShowChargerScanModal(true)}
                      >
                        <Scan className="h-3 w-3 mr-1" />
                        Update Status
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                {searchQuery || chargerTypeFilter !== 'all' ? 'No matching chargers found' : 'No assigned chargers'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions?.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{txn.inventory_items?.name}</div>
                      <div className="text-xs text-muted-foreground">{txn.reference}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        txn.direction === 'in' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {txn.direction === 'in' ? '+' : '-'}{txn.qty}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(txn.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Purchase Orders Section */}
      <EngineerPurchaseOrders />

      {/* Modals */}
      {vanLocation && engineer && (
        <>
          <EngineerScanModal 
            open={showScanModal} 
            onOpenChange={setShowScanModal}
            vanLocationId={vanLocation.id}
            vanLocationName={vanLocation.name}
          />
          <EngineerReturnModal 
            open={showReturnModal} 
            onOpenChange={setShowReturnModal}
            vanLocationId={vanLocation.id}
            vanLocationName={vanLocation.name}
            stockItems={regularItems || []}
          />
          <UseMaterialsModal
            open={showUseMaterialsModal}
            onOpenChange={setShowUseMaterialsModal}
            engineerId={engineer.id}
            vanLocationId={vanLocation.id}
            stockItems={regularItems || []}
          />
          <ChargerScanModal
            open={showChargerScanModal}
            onOpenChange={setShowChargerScanModal}
            engineerId={engineer.id}
            vanLocationId={vanLocation.id}
          />
        </>
      )}
    </div>
  );
}