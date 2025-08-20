import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Database, CheckCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface InventoryStats {
  totalItems: number;
  totalSuppliers: number;
  totalLocations: number;
  lowStockItems: number;
  totalTransactions: number;
}

export function SimpleInventoryDashboard() {
  const [stats, setStats] = useState<InventoryStats>({
    totalItems: 0,
    totalSuppliers: 0,
    totalLocations: 0,
    lowStockItems: 0,
    totalTransactions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [
        { count: itemsCount },
        { count: suppliersCount },
        { count: locationsCount },
        { count: transactionsCount },
        { data: lowStockData }
      ] = await Promise.all([
        (supabase as any).from('inventory_items').select('*', { count: 'exact', head: true }),
        (supabase as any).from('suppliers').select('*', { count: 'exact', head: true }),
        (supabase as any).from('inventory_locations').select('*', { count: 'exact', head: true }),
        (supabase as any).from('inventory_txns').select('*', { count: 'exact', head: true }),
        (supabase as any).from('vw_item_location_balances').select('item_id').lt('on_hand', 5)
      ]);

      setStats({
        totalItems: itemsCount || 0,
        totalSuppliers: suppliersCount || 0,
        totalLocations: locationsCount || 0,
        lowStockItems: lowStockData?.length || 0,
        totalTransactions: transactionsCount || 0
      });
    } catch (error) {
      console.error('Error loading inventory stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Items</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
            <p className="text-xs text-muted-foreground">
              Active items in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
            <Database className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSuppliers}</div>
            <p className="text-xs text-muted-foreground">
              Registered suppliers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLocations}</div>
            <p className="text-xs text-muted-foreground">
              Storage locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">
              Items below reorder point
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              System Overview
            </CardTitle>
            <CardDescription>
              Your inventory management system is operational with real-time tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Transactions</span>
                <span className="font-medium">{stats.totalTransactions}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Active Items</span>
                <span className="font-medium">{stats.totalItems}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Storage Locations</span>
                <span className="font-medium">{stats.totalLocations}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common inventory management tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Badge variant="outline" className="justify-start p-2">
                📦 Add new inventory items
              </Badge>
              <Badge variant="outline" className="justify-start p-2">
                🏢 Set up suppliers
              </Badge>
              <Badge variant="outline" className="justify-start p-2">
                📍 Configure locations
              </Badge>
              <Badge variant="outline" className="justify-start p-2">
                📊 View stock levels
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}