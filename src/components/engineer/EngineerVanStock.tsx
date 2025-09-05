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
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { InventoryKpiTile } from '../admin/inventory/shared/InventoryKpiTile';
import { StatusChip } from '../admin/inventory/shared/StatusChip';
import { EmptyState } from '../admin/inventory/shared/EmptyState';
import { EngineerPurchaseOrders } from './EngineerPurchaseOrders';

export function EngineerVanStock() {
  const [searchQuery, setSearchQuery] = useState('');

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

  // Get van stock items (including assigned chargers)
  const { data: stockItems, isLoading } = useQuery({
    queryKey: ['van-stock-items', vanLocation?.id, engineer?.id, searchQuery],
    queryFn: async () => {
      if (!vanLocation?.id) return [];

      const allItems = [];

      // Get regular inventory stock balances
      const { data: balances } = await supabase.rpc('get_item_location_balances');
      const vanBalances = balances?.filter(b => b.location_id === vanLocation.id && b.on_hand > 0) || [];

      if (vanBalances.length > 0) {
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
        const regularItems = items?.map(item => ({
          ...item,
          on_hand: vanBalances.find(b => b.item_id === item.id)?.on_hand || 0,
          type: 'regular'
        })) || [];

        allItems.push(...regularItems);
      }

      // Get assigned chargers for this engineer
      if (engineer?.id) {
        let chargerQuery = supabase
          .from('charger_inventory')
          .select(`
            id,
            serial_number,
            status,
            inventory_items!charger_item_id(name, sku)
          `)
          .eq('engineer_id', engineer.id)
          .in('status', ['dispatched', 'delivered']);

        const { data: assignedChargers } = await chargerQuery;

        if (assignedChargers?.length > 0) {
          const chargerItems = assignedChargers.map(charger => ({
            id: charger.id,
            name: charger.inventory_items?.name || 'Unknown Charger',
            sku: charger.serial_number,
            unit: 'unit',
            on_hand: 1,
            type: 'charger',
            status: charger.status
          }));

          // Apply search filter to chargers if provided
          const filteredChargers = searchQuery 
            ? chargerItems.filter(item => 
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.sku.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : chargerItems;

          allItems.push(...filteredChargers);
        }
      }

      return allItems;
    },
    enabled: !!vanLocation?.id && !!engineer?.id
  });

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
      <div className="grid gap-4 md:grid-cols-3">
        <InventoryKpiTile
          title="Items on Hand"
          value={metrics?.totalItems || 0}
          icon={Package}
          variant="info"
          subtitle="Items in stock"
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
      <div className="flex gap-3">
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Request Stock
        </Button>
        <Button variant="secondary">
          <Scan className="h-4 w-4 mr-2" />
          Scan Item
        </Button>
        <Button variant="secondary">
          <ArrowUpDown className="h-4 w-4 mr-2" />
          Return Stock
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stock Items */}
        <Card>
          <CardHeader>
            <CardTitle>Current Stock</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : stockItems?.length > 0 ? (
              <div className="space-y-3">
                 {stockItems.map((item) => (
                   <div key={`${item.type}-${item.id}`} className="flex items-center justify-between p-3 border rounded-lg">
                     <div className="space-y-1">
                       <div className="font-medium text-sm">
                         {item.name}
                         {item.type === 'charger' && (
                           <Badge variant="secondary" className="ml-2 text-xs">Charger</Badge>
                         )}
                       </div>
                       <div className="text-xs text-muted-foreground">
                         {item.type === 'charger' ? `Serial: ${item.sku}` : item.sku}
                       </div>
                     </div>
                     <div className="text-right">
                       <div className="text-sm font-medium">{item.on_hand} {item.unit}</div>
                       <Badge 
                         variant={item.type === 'charger' ? 
                           (item.status === 'delivered' ? 'default' : 'secondary') : 
                           'outline'
                         } 
                         className="text-xs"
                       >
                         {item.type === 'charger' ? 
                           (item.status === 'delivered' ? 'Delivered' : 'Dispatched') : 
                           'In Stock'
                         }
                       </Badge>
                     </div>
                   </div>
                 ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                {searchQuery ? 'No items found' : 'Van is empty'}
              </div>
            )}
          </CardContent>
        </Card>

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
    </div>
  );
}