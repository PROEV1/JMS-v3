import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface QuickReceiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickReceiveModal({ open, onOpenChange }: QuickReceiveModalProps) {
  const [formData, setFormData] = useState({
    item_id: "",
    location_id: "",
    quantity: "",
    reference: "",
    notes: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["inventory-items-receive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["inventory-locations-receive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const quantity = parseInt(formData.quantity);
      if (!quantity || quantity <= 0) {
        throw new Error("Quantity must be greater than 0");
      }

      const { error } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: formData.item_id,
          location_id: formData.location_id,
          qty: quantity,
          direction: 'in',
          reference: formData.reference || 'Stock Receipt',
          notes: formData.notes
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Stock Received",
        description: "Stock has been successfully added to inventory.",
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-txns"] });
      queryClient.invalidateQueries({ queryKey: ["item-location-balances"] });
      setFormData({
        item_id: "",
        location_id: "",
        quantity: "",
        reference: "",
        notes: ""
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Receipt Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_id || !formData.location_id || !formData.quantity) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    receiveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Quick Receive Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item_id">Item *</Label>
            <Select value={formData.item_id} onValueChange={(value) => setFormData(prev => ({ ...prev, item_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select item to receive" />
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
            <Label htmlFor="location_id">Location *</Label>
            <Select value={formData.location_id} onValueChange={(value) => setFormData(prev => ({ ...prev, location_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select receiving location" />
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
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
              placeholder="Enter quantity received"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Input
              id="reference"
              value={formData.reference}
              onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
              placeholder="PO number, delivery note, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes about this receipt"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={receiveMutation.isPending}>
              {receiveMutation.isPending ? "Receiving..." : "Receive Stock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}