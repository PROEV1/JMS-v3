import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck } from "lucide-react";

export function StockRequests() {
  const { data: requests, isLoading } = useQuery({
    queryKey: ["stock-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_requests")
        .select(`
          *,
          engineer:engineers(name),
          from_location:inventory_locations!from_location_id(name),
          to_location:inventory_locations!to_location_id(name),
          items:stock_request_items(
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
      case "submitted":
        return "secondary";
      case "approved":
        return "default";
      case "picked":
        return "outline";
      case "delivered":
        return "default";
      case "closed":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading stock requests...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Stock Requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Engineer</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Needed By</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests?.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="text-sm">
                  {new Date(request.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>{request.engineer?.name || "—"}</TableCell>
                <TableCell className="text-sm">{request.from_location?.name || "—"}</TableCell>
                <TableCell className="text-sm">{request.to_location?.name || "—"}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(request.status)}>
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {request.items?.length || 0} items
                    {request.items?.slice(0, 2).map((item: any) => (
                      <div key={item.id} className="text-xs text-muted-foreground">
                        {item.qty}x {item.item?.name}
                      </div>
                    ))}
                    {(request.items?.length || 0) > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{(request.items?.length || 0) - 2} more
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {request.needed_by ? new Date(request.needed_by).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-sm max-w-xs truncate">{request.notes || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}