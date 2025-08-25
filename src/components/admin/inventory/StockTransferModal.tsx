import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInventoryEnhanced } from "@/hooks/useInventoryEnhanced";
import { useToast } from "@/hooks/use-toast";

interface StockTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemName?: string;
}

export function StockTransferModal({ open, onOpenChange, itemId, itemName }: StockTransferModalProps) {
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const { createStockTransfer, useInventoryLocations, useItemLocationBalances } = useInventoryEnhanced();
  const { toast } = useToast();

  // Fetch locations and balances
  const { data: locations } = useInventoryLocations();
  const { data: balances } = useItemLocationBalances(itemId);

  // Reset form when modal opens/closes or item changes
  useEffect(() => {
    if (!open || !itemId) {
      setFromLocationId("");
      setToLocationId("");
      setQuantity("");
      setNotes("");
    }
  }, [open, itemId]);

  // Get stock balance for a specific location
  const getLocationBalance = (locationId: string) => {
    if (!balances || !itemId) return 0;
    const balance = balances.find((b: any) => b.location_id === locationId);
    return balance?.on_hand || 0;
  };

  // Get available stock at selected from location
  const availableStock = fromLocationId ? getLocationBalance(fromLocationId) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!itemId || !fromLocationId || !toLocationId || !quantity) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const transferQty = parseInt(quantity);

    if (fromLocationId === toLocationId) {
      toast({
        title: "Error",
        description: "Source and destination locations must be different",
        variant: "destructive",
      });
      return;
    }

    if (transferQty > availableStock) {
      toast({
        title: "Error",
        description: `Insufficient stock. Available: ${availableStock}, Requested: ${transferQty}`,
        variant: "destructive",
      });
      return;
    }

    if (transferQty <= 0) {
      toast({
        title: "Error",
        description: "Quantity must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    try {
      await createStockTransfer.mutateAsync({
        itemId: itemId,
        fromLocationId: fromLocationId,
        toLocationId: toLocationId,
        quantity: transferQty,
        notes,
      });

      toast({
        title: "Success",
        description: "Stock transfer completed successfully",
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete stock transfer",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Transfer Stock - {itemName}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="from-location">From Location *</Label>
            <Select value={fromLocationId} onValueChange={setFromLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location) => {
                  const balance = getLocationBalance(location.id);
                  return (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} (Stock: {balance})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {fromLocationId && (
              <p className="text-sm text-muted-foreground">
                Available stock: {availableStock} units
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="to-location">To Location *</Label>
            <Select value={toLocationId} onValueChange={setToLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location) => {
                  const balance = getLocationBalance(location.id);
                  const isDisabled = location.id === fromLocationId;
                  return (
                    <SelectItem 
                      key={location.id} 
                      value={location.id}
                      disabled={isDisabled}
                    >
                      {location.name} (Stock: {balance})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity to transfer"
              min="1"
              max={availableStock}
              required
            />
            {availableStock > 0 && (
              <p className="text-sm text-muted-foreground">
                Maximum: {availableStock} units
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Transfer notes (optional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createStockTransfer.isPending || !fromLocationId || !toLocationId || availableStock <= 0}
            >
              {createStockTransfer.isPending ? "Transferring..." : "Transfer Stock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}