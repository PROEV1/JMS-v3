import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Package, TrendingDown, ShoppingCart } from "lucide-react";

export function InventoryDashboard() {
  const { data: lowStockItems, isLoading: loadingLowStock } = useQuery({
    queryKey: ["low-stock-items"],
    queryFn: async () => {
      // Get items and their balances
      const { data: items, error: itemsError } = await supabase
        .from("inventory_items")
        .select("*");
      if (itemsError) throw itemsError;

      const { data: balances, error: balancesError } = await supabase
        .from("vw_item_location_balances")
        .select("*");
      if (balancesError) throw balancesError;

      // Calculate total stock per item and filter low stock
      const itemsWithStock = items.map(item => {
        const totalStock = balances
          .filter(b => b.item_id === item.id)
          .reduce((sum, b) => sum + (b.on_hand || 0), 0);
        
        return {
          ...item,
          totalStock,
          isLowStock: totalStock <= item.reorder_point,
        };
      });

      return itemsWithStock.filter(item => item.isLowStock);
    },
  });

  const { data: recentTransactions } = useQuery({
    queryKey: ["recent-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_txns")
        .select(`
          *,
          item:inventory_items(name, sku)
        `)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: openPOs } = useQuery({
    queryKey: ["open-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .in("status", ["submitted", "confirmed", "partially_received"])
        .order("expected_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockItems?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Items at or below reorder point
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Purchase Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openPOs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
            <TrendingDown className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentTransactions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 10 movements
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {(lowStockItems?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Reorder Point</TableHead>
                  <TableHead>Min Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockItems?.slice(0, 10).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{item.totalStock}</Badge>
                    </TableCell>
                    <TableCell>{item.reorder_point}</TableCell>
                    <TableCell>{item.min_level}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Open Purchase Orders */}
      {(openPOs?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Open Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openPOs?.slice(0, 5).map((po) => (
                  <TableRow key={po.id}>
                    <TableCell>{po.supplier?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{po.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {po.expected_at ? new Date(po.expected_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{po.reference || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}