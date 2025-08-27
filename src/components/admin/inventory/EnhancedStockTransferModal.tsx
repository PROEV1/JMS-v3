import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventoryEnhanced } from "@/hooks/useInventoryEnhanced";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";

interface TransferItem {
  itemId: string;
  itemName: string;
  itemSku: string;
  quantity: number;
  availableStock: number;
}

interface EnhancedStockTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnhancedStockTransferModal({ open, onOpenChange }: EnhancedStockTransferModalProps) {
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);

  const { createStockTransfer, useInventoryLocations, useInventoryItems, useItemLocationBalances } = useInventoryEnhanced();
  const { toast } = useToast();

  // Fetch locations and items
  const { data: locations } = useInventoryLocations();
  const { data: items } = useInventoryItems();
  const { data: allBalances } = useItemLocationBalances();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setFromLocationId("");
      setToLocationId("");
      setNotes("");
      setTransferItems([]);
      setAvailableItems([]);
    }
  }, [open]);

  // Update available items when from location changes
  useEffect(() => {
    if (fromLocationId && items && allBalances) {
      const itemsWithStock = items
        .map(item => {
          const balance = allBalances.find(b => b.item_id === item.id && b.location_id === fromLocationId);
          return {
            ...item,
            currentStock: balance?.on_hand || 0
          };
        })
        .filter(item => item.currentStock > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setAvailableItems(itemsWithStock);
      // Clear existing transfer items when location changes
      setTransferItems([]);
    }
  }, [fromLocationId, items, allBalances]);

  const addTransferItem = (itemId: string) => {
    const item = availableItems.find(i => i.id === itemId);
    if (!item) return;

    if (transferItems.find(t => t.itemId === itemId)) {
      toast({
        title: "Item already added",
        description: "This item is already in the transfer list",
        variant: "destructive",
      });
      return;
    }

    setTransferItems(prev => [...prev, {
      itemId: item.id,
      itemName: item.name,
      itemSku: item.sku,
      quantity: 1,
      availableStock: item.currentStock
    }]);
  };

  const removeTransferItem = (itemId: string) => {
    setTransferItems(prev => prev.filter(item => item.itemId !== itemId));
  };

  const updateTransferQuantity = (itemId: string, quantity: number) => {
    setTransferItems(prev => prev.map(item => 
      item.itemId === itemId ? { ...item, quantity } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fromLocationId || !toLocationId || transferItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select locations and at least one item to transfer",
        variant: "destructive",
      });
      return;
    }

    if (fromLocationId === toLocationId) {
      toast({
        title: "Error",
        description: "Source and destination locations must be different",
        variant: "destructive",
      });
      return;
    }

    // Validate all quantities
    for (const item of transferItems) {
      if (item.quantity <= 0) {
        toast({
          title: "Error",
          description: `Quantity for ${item.itemName} must be greater than 0`,
          variant: "destructive",
        });
        return;
      }

      if (item.quantity > item.availableStock) {
        toast({
          title: "Error",
          description: `Insufficient stock for ${item.itemName}. Available: ${item.availableStock}, Requested: ${item.quantity}`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // Process each transfer item
      for (const item of transferItems) {
        await createStockTransfer.mutateAsync({
          itemId: item.itemId,
          fromLocationId: fromLocationId,
          toLocationId: toLocationId,
          quantity: item.quantity,
          notes: `${notes} - ${item.itemName} (${item.itemSku})`,
        });
      }

      toast({
        title: "Success",
        description: `Successfully transferred ${transferItems.length} items`,
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

  const getLocationDisplayName = (locationId: string) => {
    const location = locations?.find(l => l.id === locationId);
    return location ? location.name : '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer Stock Between Locations</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-location">From Location *</Label>
              <Select value={fromLocationId} onValueChange={setFromLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source location" />
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
              <Label htmlFor="to-location">To Location *</Label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination location" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((location) => {
                    const isDisabled = location.id === fromLocationId;
                    return (
                      <SelectItem 
                        key={location.id} 
                        value={location.id}
                        disabled={isDisabled}
                      >
                        {location.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Available Items to Add */}
          {fromLocationId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Available Items at {getLocationDisplayName(fromLocationId)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 max-h-40 overflow-y-auto">
                  {availableItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">
                          SKU: {item.sku} | Available: {item.currentStock} units
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => addTransferItem(item.id)}
                        disabled={transferItems.some(t => t.itemId === item.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
                  {availableItems.length === 0 && fromLocationId && (
                    <div className="text-center py-4 text-muted-foreground">
                      No items available at selected location
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transfer Items List */}
          {transferItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Items to Transfer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transferItems.map((item) => (
                    <div key={item.itemId} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{item.itemName}</div>
                        <div className="text-sm text-muted-foreground">
                          SKU: {item.itemSku} | Available: {item.availableStock} units
                        </div>
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          min="1"
                          max={item.availableStock}
                          value={item.quantity}
                          onChange={(e) => updateTransferQuantity(item.itemId, parseInt(e.target.value) || 0)}
                          placeholder="Qty"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTransferItem(item.itemId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Transfer Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this transfer (optional)"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createStockTransfer.isPending || !fromLocationId || !toLocationId || transferItems.length === 0}
            >
              {createStockTransfer.isPending ? "Transferring..." : `Transfer ${transferItems.length} Items`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}