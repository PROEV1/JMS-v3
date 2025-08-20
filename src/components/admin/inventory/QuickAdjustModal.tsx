import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface QuickAdjustModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickAdjustModal({ open, onOpenChange }: QuickAdjustModalProps) {
  const [itemId, setItemId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [direction, setDirection] = useState<"in" | "out" | "adjust">("adjust");
  const [qty, setQty] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch items and locations for dropdowns
  const { data: items } = useQuery({
    queryKey: ["inventory-items-for-adjust"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: locations } = useQuery({
    queryKey: ["inventory-locations-for-adjust"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const addTransactionMutation = useMutation({
    mutationFn: async (txnData: {
      item_id: string;
      location_id: string;
      qty: number;
      direction: string;
      reference?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('inventory_txns')
        .insert(txnData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock adjustment recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record stock adjustment. Please try again.",
        variant: "destructive",
      });
      console.error("Error recording transaction:", error);
    },
  });

  const resetForm = () => {
    setItemId("");
    setLocationId("");
    setDirection("adjust");
    setQty("");
    setReference("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!itemId || !locationId || !qty) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const qtyNum = parseInt(qty);
    if (isNaN(qtyNum) || qtyNum === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    addTransactionMutation.mutate({
      item_id: itemId,
      location_id: locationId,
      qty: qtyNum,
      direction,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stock Adjustment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item">Item *</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item" />
              </SelectTrigger>
              <SelectContent>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name} {location.code && `(${location.code})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="direction">Type *</Label>
            <Select value={direction} onValueChange={(value: "in" | "out" | "adjust") => setDirection(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Stock In (+)</SelectItem>
                <SelectItem value="out">Stock Out (-)</SelectItem>
                <SelectItem value="adjust">Adjustment (±)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty">Quantity *</Label>
            <Input
              id="qty"
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Enter quantity"
              required
            />
            <p className="text-xs text-muted-foreground">
              {direction === 'out' ? 'Quantity will be subtracted from stock' : direction === 'in' ? 'Quantity will be added to stock' : 'Enter positive or negative quantity for adjustment'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="PO number, invoice, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this transaction"
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addTransactionMutation.isPending}>
              {addTransactionMutation.isPending ? "Recording..." : "Record Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}