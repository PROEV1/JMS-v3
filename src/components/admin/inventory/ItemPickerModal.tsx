import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Package, Plus, Trash2 } from "lucide-react";
import { useInventoryEnhanced } from '@/hooks/useInventoryEnhanced';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ItemPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: { id: string; name: string; type: string };
  onItemAdded?: () => void;
}

export function ItemPickerModal({ open, onOpenChange, location, onItemAdded }: ItemPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('Stock addition');
  const [notes, setNotes] = useState<string>('');
  const [isApproving, setIsApproving] = useState<boolean>(false);

  const { toast } = useToast();
  const { useInventoryItems, createStockAdjustment, deleteInventoryItem } = useInventoryEnhanced();
  const { data: allItems = [], isLoading, error } = useInventoryItems();

  // Debug logging
  console.log('ItemPickerModal - allItems:', allItems);
  console.log('ItemPickerModal - isLoading:', isLoading);
  console.log('ItemPickerModal - error:', error);

  // Filter items by search term
  const filteredItems = allItems.filter(item => {
    return searchTerm === '' || 
           item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleAddToStock = async () => {
    if (!selectedItem || quantity <= 0) {
      toast({
        title: "Invalid Selection",
        description: "Please select an item and enter a valid quantity.",
        variant: "destructive",
      });
      return;
    }

    setIsApproving(true);
    try {
      // Get current user for approval
      const { data: userData } = await supabase.auth.getUser();
      
      // Use direct Supabase call with auto-approval like LocationStockModal does
      const { data, error } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: selectedItem.id,
          location_id: location.id,
          direction: 'adjust',
          qty: quantity,
          reference: `Stock adjustment: ${reason}`,
          notes: notes || `Added ${quantity} units of ${selectedItem.name} to ${location.name}`,
          status: 'approved', // Auto-approve admin stock adjustments
          approved_by: userData.user?.id,
          approved_at: new Date().toISOString(),
          created_by: userData.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Item Added to Stock",
        description: `Successfully added ${quantity} units of ${selectedItem.name} to ${location.name}`,
      });

      // Reset form and close modal
      setSelectedItem(null);
      setQuantity(1);
      setReason('Stock addition');
      setNotes('');
      setSearchTerm('');
      onOpenChange(false);
      
      // Trigger refresh of parent
      onItemAdded?.();
    } catch (error: any) {
      toast({
        title: "Failed to Add Item",
        description: error.message || "Failed to add item to stock. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeleteItem = async (item: any, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent selecting the item when clicking delete
    
    if (window.confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
      try {
        await deleteInventoryItem.mutateAsync(item.id);
        
        toast({
          title: "Item Deleted",
          description: `Successfully deleted ${item.name}`,
        });
        
        // Clear selection if the deleted item was selected
        if (selectedItem?.id === item.id) {
          setSelectedItem(null);
        }
      } catch (error: any) {
        toast({
          title: "Failed to Delete Item",
          description: error.message || "Failed to delete item. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Item to {location.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Search */}
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

          {/* Items List */}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            <h3 className="font-medium">Select Item ({filteredItems.length} items)</h3>
            
            {filteredItems.map((item) => (
              <Card 
                key={item.id} 
                className={`cursor-pointer transition-colors ${
                  selectedItem?.id === item.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedItem(item)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        {selectedItem?.id === item.id && (
                          <div className="w-2 h-2 bg-primary rounded-full" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Unit: {item.unit || 'each'}</span>
                        <span>Cost: £{item.default_cost || 0}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleDeleteItem(item, e)}
                      disabled={deleteInventoryItem.isPending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredItems.length === 0 && !isLoading && (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Items Found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? 'No items match your search criteria.' : error ? `Error loading items: ${error.message}` : 'No inventory items available.'}
                  </p>
                </CardContent>
              </Card>
            )}

            {isLoading && (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <h3 className="text-lg font-medium mb-2">Loading Items...</h3>
                  <p className="text-muted-foreground">Fetching inventory data...</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Add to Stock Form */}
          {selectedItem && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-4">
                <h3 className="font-medium">Add "{selectedItem.name}" to Stock</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setQuantity(0);
                        } else {
                          setQuantity(Math.max(1, parseInt(value) || 1));
                        }
                      }}
                      onBlur={(e) => {
                        // Ensure minimum value of 1 on blur
                        if (quantity < 1) {
                          setQuantity(1);
                        }
                      }}
                      placeholder="Enter quantity"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reason">Reason</Label>
                    <Input
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g., Stock received, Transfer"
                    />
                  </div>
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
                    onClick={handleAddToStock}
                    disabled={isApproving || !selectedItem || quantity <= 0}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {isApproving ? "Adding..." : `Add ${quantity} to Stock`}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedItem(null)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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