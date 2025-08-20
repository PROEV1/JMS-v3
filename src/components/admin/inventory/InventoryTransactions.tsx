import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search } from "lucide-react";

export function InventoryTransactions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["inventory-transactions", searchTerm, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("inventory_txns")
        .select(`
          *,
          item:inventory_items(name, sku),
          from_location:inventory_locations!from_location_id(name),
          to_location:inventory_locations!to_location_id(name),
          order:orders(order_number),
          serial:inventory_serials(serial_number)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (typeFilter !== "all") {
        query = query.eq("txn_type", typeFilter);
      }

      if (searchTerm) {
        // This is a simplified search - in production you might want more sophisticated filtering
        query = query.or(`notes.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getTxnTypeVariant = (type: string) => {
    switch (type) {
      case "receive":
        return "default";
      case "move":
        return "secondary";
      case "consume":
        return "destructive";
      case "adjust":
        return "outline";
      case "return":
        return "default";
      case "rma_out":
        return "destructive";
      case "rma_in":
        return "default";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading transactions...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Transaction Log
        </CardTitle>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="receive">Receive</SelectItem>
              <SelectItem value="move">Move</SelectItem>
              <SelectItem value="consume">Consume</SelectItem>
              <SelectItem value="adjust">Adjust</SelectItem>
              <SelectItem value="return">Return</SelectItem>
              <SelectItem value="rma_out">RMA Out</SelectItem>
              <SelectItem value="rma_in">RMA In</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell className="text-sm">
                  {new Date(txn.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={getTxnTypeVariant(txn.txn_type)}>
                    {txn.txn_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{txn.item?.name}</div>
                    <div className="text-xs text-muted-foreground">{txn.item?.sku}</div>
                  </div>
                </TableCell>
                <TableCell>{txn.qty}</TableCell>
                <TableCell className="text-sm">{txn.from_location?.name || "—"}</TableCell>
                <TableCell className="text-sm">{txn.to_location?.name || "—"}</TableCell>
                <TableCell className="text-sm">{txn.order?.order_number || "—"}</TableCell>
                <TableCell className="text-sm font-mono">{txn.serial?.serial_number || "—"}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">{txn.notes || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}