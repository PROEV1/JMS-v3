import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, MapPin, Warehouse, Truck, MapPinIcon } from "lucide-react";
import { CreateLocationModal } from "./CreateLocationModal";

export function InventoryLocations() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: locations, isLoading, refetch } = useQuery({
    queryKey: ["inventory-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_locations")
        .select(`
          *,
          engineer:engineers(name),
          order:orders(order_number)
        `)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const getLocationIcon = (type: string) => {
    switch (type) {
      case "warehouse":
        return <Warehouse className="h-4 w-4" />;
      case "van":
        return <Truck className="h-4 w-4" />;
      case "job_site":
        return <MapPinIcon className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  const getLocationVariant = (type: string) => {
    switch (type) {
      case "warehouse":
        return "default";
      case "van":
        return "secondary";
      case "job_site":
        return "outline";
      default:
        return "default";
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading locations...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Inventory Locations
          </CardTitle>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Engineer</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations?.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.name}</TableCell>
                <TableCell>
                  <Badge variant={getLocationVariant(location.location_type)} className="flex items-center gap-1 w-fit">
                    {getLocationIcon(location.location_type)}
                    {location.location_type.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>{location.engineer?.name || "—"}</TableCell>
                <TableCell>{location.order?.order_number || "—"}</TableCell>
                <TableCell>
                  <Badge variant={location.is_active ? "default" : "secondary"}>
                    {location.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(location.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <CreateLocationModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
        onSuccess={() => {
          refetch();
          setShowCreateModal(false);
        }}
      />
    </Card>
  );
}