import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Package, AlertTriangle, Plus, Edit3, Minus, Search } from "lucide-react";
import { useInventoryEnhanced } from '@/hooks/useInventoryEnhanced';
import { useToast } from '@/hooks/use-toast';

interface LocationStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: { id: string; name: string; type: string };
}

export function LocationStockModal({ open, onOpenChange, location }: LocationStockModalProps) {
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { toast } = useToast();
  const { 
    useInventoryItems,
    useItemLocationBalances, 
    createStockAdjustment
  } = useInventoryEnhanced();

  const { data: allItems = [] } = useInventoryItems();
  const { data: locationBalances = [] } = useItemLocationBalances();

  if (!location) return null;

  // Filter balances for this location only
  const currentLocationBalances = locationBalances.filter(
    balance => balance.location_id === location.id
  );

  // Show all items when adding - filter only by search term
  const availableItems = allItems.filter(item => {
    return searchTerm === '' || 
           item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Show items that have any stock (even zero) at this location for management
  const itemsWithBalance = locationBalances
    .filter(balance => balance.location_id === location.id)
    .map(balance => {
      const item = allItems.find(i => i.id === balance.item_id);
      return item ? { ...item, currentStock: balance.on_hand } : null;
    })
    .filter(Boolean);

  const totalValue = itemsWithBalance.reduce((sum, item) => {
    return sum + ((item?.currentStock || 0) * (item?.default_cost || 0));
  }, 0);

  const lowStockItems = itemsWithBalance.filter(item => {
    return item && (item.currentStock || 0) <= (item.reorder_point || 5);
  });

  const handleAddItem = async () => {
    if (!selectedItemId || quantity <= 0 || !reason) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all required fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createStockAdjustment.mutateAsync({
        itemId: selectedItemId,
        locationId: location.id,
        quantity: quantity,
        reason,
        notes: notes || undefined
      });

      const selectedItem = allItems.find(item => item.id === selectedItemId);
      toast({
        title: "Item Added",
        description: `Successfully added ${quantity} units of ${selectedItem?.name} to ${location.name}`,
      });

      // Reset form
      setSelectedItemId('');
      setQuantity(0);
      setReason('');
      setNotes('');
      setShowAddItemForm(false);
    } catch (error: any) {
      toast({
        title: "Failed to Add Item",
        description: error.message || "Failed to add item. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAdjustStock = async (itemId: string, adjustment: number, adjustmentReason: string) => {
    try {
      await createStockAdjustment.mutateAsync({
        itemId,
        locationId: location.id,
        quantity: adjustment,
        reason: adjustmentReason,
        notes: `Quick ${adjustment > 0 ? 'addition' : 'removal'} from location stock view`
      });

      const item = allItems.find(i => i.id === itemId);
      toast({
        title: "Stock Updated",
        description: `${adjustment > 0 ? 'Added' : 'Removed'} ${Math.abs(adjustment)} units of ${item?.name}`,
      });
    } catch (error: any) {
      toast({
        title: "Stock Update Failed",
        description: error.message || "Failed to update stock. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock at {location.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{itemsWithBalance.length}</p>
                <p className="text-sm text-muted-foreground">Items</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">£{totalValue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Value</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-orange-600">{lowStockItems.length}</p>
                <p className="text-sm text-muted-foreground">Low Stock</p>
              </CardContent>
            </Card>
          </div>

          {/* Add Item Form */}
          {showAddItemForm && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Add Item to Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search Items</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name or SKU..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="item">Select Item</Label>
                    <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose item to add" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {availableItems.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">
                            {searchTerm ? 'No items match your search' : 'All items are already stocked here'}
                          </div>
                        ) : (
                          availableItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{item.name}</span>
                                <span className="text-xs text-muted-foreground">SKU: {item.sku}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      placeholder="Enter quantity"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="reason">Reason *</Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Stock received, Transfer from warehouse"
                  />
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes..."
                    rows={2}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddItem}
                    disabled={createStockAdjustment.isPending || !reason || !selectedItemId || quantity <= 0}
                  >
                    {createStockAdjustment.isPending ? "Adding..." : "Add Item"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddItemForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <p className="font-medium text-orange-800">Low Stock Alert</p>
                </div>
                <p className="text-sm text-orange-700">
                  {lowStockItems.length} item(s) are at or below their reorder point
                </p>
              </CardContent>
            </Card>
          )}

          {/* Stock Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Inventory Items</h3>
              {!showAddItemForm && (
                <Button onClick={() => setShowAddItemForm(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
            
            {itemsWithBalance.map((item) => {
              if (!item) return null;
              
              const isLowStock = (item.currentStock || 0) <= (item.reorder_point || 5);
              
              return (
                <Card key={item.id} className={isLowStock ? "border-orange-200" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{item.name}</p>
                          {isLowStock && (item.currentStock || 0) > 0 && (
                            <Badge variant="outline" className="text-orange-600 border-orange-200">
                              Low Stock
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Available: {item.currentStock || 0}</span>
                          <span>Reorder at: {item.reorder_point || 5}</span>
                          <span>Unit: {item.unit || 'units'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-semibold">{item.currentStock || 0}</p>
                          <p className="text-sm text-muted-foreground">{item.unit || 'units'}</p>
                        </div>
                        
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleAdjustStock(item.id, 1, 'Quick add')}
                            title="Add 1 unit"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleAdjustStock(item.id, -1, 'Quick remove')}
                            disabled={(item.currentStock || 0) <= 0}
                            title="Remove 1 unit"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {itemsWithBalance.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Items in Stock</h3>
                  <p className="text-muted-foreground mb-4">
                    This location doesn't have any items yet.
                  </p>
                  <Button onClick={() => setShowAddItemForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Item
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}