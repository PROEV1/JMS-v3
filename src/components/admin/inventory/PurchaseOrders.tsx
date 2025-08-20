import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart } from "lucide-react";

export function PurchaseOrders() {
  const { data: pos, isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          supplier:suppliers(name),
          items:purchase_order_items(
            *,
            item:inventory_items(name, sku)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "draft":
        return "secondary";
      case "submitted":
        return "outline";
      case "confirmed":
        return "default";
      case "partially_received":
        return "secondary";
      case "received":
        return "default";
      case "closed":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const calculateTotal = (items: any[]) => {
    return items.reduce((sum, item) => sum + (item.qty_ordered * item.unit_cost), 0);
  };

  if (isLoading) {
    return <div className="p-6">Loading purchase orders...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Purchase Orders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pos?.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="text-sm">
                  {new Date(po.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>{po.supplier?.name}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(po.status)}>
                    {po.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {po.items?.length || 0} items
                    {po.items?.slice(0, 2).map((item: any) => (
                      <div key={item.id} className="text-xs text-muted-foreground">
                        {item.qty_ordered}x {item.item?.name}
                      </div>
                    ))}
                    {(po.items?.length || 0) > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{(po.items?.length || 0) - 2} more
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm font-mono">
                  £{calculateTotal(po.items || []).toFixed(2)}
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
  );
}