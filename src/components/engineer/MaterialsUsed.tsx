import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Scan, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface MaterialsUsedProps {
  orderId: string;
  engineerId: string;
}

interface MaterialToConsume {
  item_id: string;
  item_name: string;
  item_sku: string;
  is_serialized: boolean;
  qty: number;
  serial_ids: string[];
  notes?: string;
}

export function MaterialsUsed({ orderId, engineerId }: MaterialsUsedProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [materialsToConsume, setMaterialsToConsume] = useState<MaterialsToConsume[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [serialInput, setSerialInput] = useState("");
  const [notes, setNotes] = useState("");

  // Get engineer's van location
  const { data: vanLocation } = useQuery({
    queryKey: ["engineer-van", engineerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_locations")
        .select("*")
        .eq("location_type", "van")
        .eq("engineer_id", engineerId)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Get van stock
  const { data: vanStock } = useQuery({
    queryKey: ["van-stock", vanLocation?.id],
    queryFn: async () => {
      if (!vanLocation?.id) return [];
      
      const { data, error } = await supabase
        .from("vw_item_location_balances")
        .select(`
          *,
          item:inventory_items(*)
        `)
        .eq("location_id", vanLocation.id)
        .gt("on_hand", 0);
      if (error) throw error;
      return data;
    },
    enabled: !!vanLocation?.id,
  });

  // Get serials in van for selected item
  const { data: availableSerials } = useQuery({
    queryKey: ["van-serials", vanLocation?.id, selectedItemId],
    queryFn: async () => {
      if (!vanLocation?.id || !selectedItemId) return [];
      
      const { data, error } = await supabase
        .from("inventory_serials")
        .select("*")
        .eq("item_id", selectedItemId)
        .eq("current_location_id", vanLocation.id)
        .eq("status", "in_stock");
      if (error) throw error;
      return data;
    },
    enabled: !!vanLocation?.id && !!selectedItemId,
  });

  // Get already consumed materials for this order
  const { data: consumedMaterials } = useQuery({
    queryKey: ["consumed-materials", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_txns")
        .select(`
          *,
          item:inventory_items(name, sku, is_serialized),
          serial:inventory_serials(serial_number)
        `)
        .eq("order_id", orderId)
        .eq("txn_type", "consume")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const consumeMutation = useMutation({
    mutationFn: async (material: MaterialsToConsume) => {
      const { data, error } = await supabase.rpc("inv_consume", {
        p_order_id: orderId,
        p_from_location_id: vanLocation?.id,
        p_item_id: material.item_id,
        p_qty: material.qty,
        p_serial_ids: material.is_serialized ? material.serial_ids : null,
        p_notes: material.notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Materials consumed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["consumed-materials", orderId] });
      queryClient.invalidateQueries({ queryKey: ["van-stock"] });
      queryClient.invalidateQueries({ queryKey: ["van-serials"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedItem = vanStock?.find(s => s.item.id === selectedItemId)?.item;

  const addMaterial = () => {
    if (!selectedItem) return;

    if (selectedItem.is_serialized && serialInput.trim().split(",").length !== qty) {
      toast({
        title: "Error",
        description: "Number of serials must match quantity",
        variant: "destructive",
      });
      return;
    }

    const serialIds = selectedItem.is_serialized ? serialInput.trim().split(",").map(s => s.trim()) : [];

    setMaterialsToConsume(prev => [...prev, {
      item_id: selectedItem.id,
      item_name: selectedItem.name,
      item_sku: selectedItem.sku,
      is_serialized: selectedItem.is_serialized,
      qty,
      serial_ids: serialIds,
      notes: notes.trim() || undefined,
    }]);

    // Reset form
    setSelectedItemId("");
    setQty(1);
    setSerialInput("");
    setNotes("");
  };

  const removeMaterial = (index: number) => {
    setMaterialsToConsume(prev => prev.filter((_, i) => i !== index));
  };

  const consumeAllMaterials = async () => {
    for (const material of materialsToConsume) {
      await consumeMutation.mutateAsync(material);
    }
    setMaterialsToConsume([]);
  };

  if (!vanLocation) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No van location found for this engineer.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Materials Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Materials Used
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="item">Item</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item from van stock" />
                </SelectTrigger>
                <SelectContent>
                  {vanStock?.map((stock) => (
                    <SelectItem key={stock.item.id} value={stock.item.id}>
                      {stock.item.name} ({stock.item.sku}) - {stock.on_hand} available
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {selectedItem?.is_serialized && (
            <div>
              <Label htmlFor="serials">Serial Numbers (comma-separated)</Label>
              <Input
                id="serials"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="Enter serial numbers separated by commas"
              />
              {availableSerials && availableSerials.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">Available serials:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {availableSerials.map((serial) => (
                      <Badge
                        key={serial.id}
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => {
                          const currentSerials = serialInput.split(",").map(s => s.trim()).filter(Boolean);
                          if (!currentSerials.includes(serial.serial_number)) {
                            setSerialInput(prev => prev ? `${prev}, ${serial.serial_number}` : serial.serial_number);
                          }
                        }}
                      >
                        {serial.serial_number}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes"
            />
          </div>

          <Button onClick={addMaterial} disabled={!selectedItemId}>
            <Plus className="h-4 w-4 mr-2" />
            Add to List
          </Button>
        </CardContent>
      </Card>

      {/* Materials to Consume */}
      {materialsToConsume.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Materials to Consume</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Serials</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialsToConsume.map((material, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{material.item_name}</div>
                        <div className="text-xs text-muted-foreground">{material.item_sku}</div>
                      </div>
                    </TableCell>
                    <TableCell>{material.qty}</TableCell>
                    <TableCell className="text-sm">
                      {material.serial_ids.length > 0 ? material.serial_ids.join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{material.notes || "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMaterial(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <div className="mt-4 flex justify-end">
              <Button onClick={consumeAllMaterials} disabled={consumeMutation.isPending}>
                {consumeMutation.isPending ? "Consuming..." : "Consume All Materials"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already Consumed Materials */}
      {consumedMaterials && consumedMaterials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Materials Already Used</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consumedMaterials.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-sm">
                      {new Date(txn.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{txn.item?.name}</div>
                        <div className="text-xs text-muted-foreground">{txn.item?.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell>{txn.qty}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {txn.serial?.serial_number || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{txn.notes || "—"}</TableCell>
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