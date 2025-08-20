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
import { ArrowRight } from "lucide-react";

interface StockTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockTransferModal({ open, onOpenChange }: StockTransferModalProps) {
  const [formData, setFormData] = useState({
    item_id: "",
    from_location_id: "",
    to_location_id: "",
    quantity: "",
    reference: "",
    notes: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["inventory-items-transfer"],
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
    queryKey: ["inventory-locations-transfer"],
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

  const transferMutation = useMutation({
    mutationFn: async () => {
      const quantity = parseInt(formData.quantity);
      if (!quantity || quantity <= 0) {
        throw new Error("Quantity must be greater than 0");
      }

      // Create "out" transaction for source location
      const { error: outError } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: formData.item_id,
          location_id: formData.from_location_id,
          qty: quantity,
          direction: 'out',
          reference: formData.reference || `Transfer to ${locations?.find(l => l.id === formData.to_location_id)?.name}`,
          notes: formData.notes
        });

      if (outError) throw outError;

      // Create "in" transaction for destination location
      const { error: inError } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: formData.item_id,
          location_id: formData.to_location_id,
          qty: quantity,
          direction: 'in',
          reference: formData.reference || `Transfer from ${locations?.find(l => l.id === formData.from_location_id)?.name}`,
          notes: formData.notes
        });

      if (inError) throw inError;
    },
    onSuccess: () => {
      toast({
        title: "Stock Transfer Completed",
        description: "Stock has been successfully transferred between locations.",
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-txns"] });
      queryClient.invalidateQueries({ queryKey: ["item-location-balances"] });
      setFormData({
        item_id: "",
        from_location_id: "",
        to_location_id: "",
        quantity: "",
        reference: "",
        notes: ""
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_id || !formData.from_location_id || !formData.to_location_id || !formData.quantity) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (formData.from_location_id === formData.to_location_id) {
      toast({
        title: "Invalid Transfer",
        description: "Source and destination locations must be different.",
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transfer Stock Between Locations</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item_id">Item *</Label>
            <Select value={formData.item_id} onValueChange={(value) => setFormData(prev => ({ ...prev, item_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select item to transfer" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from_location_id">From Location *</Label>
              <Select value={formData.from_location_id} onValueChange={(value) => setFormData(prev => ({ ...prev, from_location_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="to_location_id">To Location *</Label>
              <Select value={formData.to_location_id} onValueChange={(value) => setFormData(prev => ({ ...prev, to_location_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Destination" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-center py-2">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
              placeholder="Enter quantity to transfer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Input
              id="reference"
              value={formData.reference}
              onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
              placeholder="Transfer reference (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes about this transfer"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={transferMutation.isPending}>
              {transferMutation.isPending ? "Transferring..." : "Transfer Stock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}