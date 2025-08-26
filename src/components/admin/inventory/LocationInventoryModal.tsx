import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Package, Plus, Minus, Edit3, Trash2, AlertTriangle, MapPin } from "lucide-react";
import { useInventoryEnhanced } from '@/hooks/useInventoryEnhanced';
import { useToast } from '@/hooks/use-toast';

interface LocationInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemName?: string;
}

export function LocationInventoryModal({ open, onOpenChange, itemId, itemName }: LocationInventoryModalProps) {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  const { toast } = useToast();
  const { 
    useInventoryLocations, 
    useItemLocationBalances, 
    createStockAdjustment,
    createStockTransfer 
  } = useInventoryEnhanced();

  const { data: locations = [] } = useInventoryLocations();
  const { data: locationBalances = [] } = useItemLocationBalances(itemId);

  const handleStockAdjustment = async () => {
    if (!selectedLocationId || !itemId || quantity <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all required fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    try {
      let adjustmentQty = quantity;
      
      if (adjustmentType === 'remove') {
        adjustmentQty = -quantity;
      } else if (adjustmentType === 'set') {
        const currentBalance = locationBalances.find(b => b.location_id === selectedLocationId);
        const currentQty = currentBalance?.on_hand || 0;
        adjustmentQty = quantity - currentQty;
      }

      await createStockAdjustment.mutateAsync({
        itemId,
        locationId: selectedLocationId,
        quantity: adjustmentQty,
        reason,
        notes: notes || undefined
      });

      toast({
        title: "Stock Updated",
        description: `Successfully ${adjustmentType === 'remove' ? 'removed' : 'adjusted'} stock for ${itemName}`,
      });

      // Reset form
      setQuantity(0);
      setReason('');
      setNotes('');
      setShowAddForm(false);
    } catch (error: any) {
      toast({
        title: "Stock Adjustment Failed",
        description: error.message || "Failed to adjust stock. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddToLocation = async (locationId: string) => {
    setSelectedLocationId(locationId);
    setAdjustmentType('add');
    setShowAddForm(true);
  };

  const handleRemoveFromLocation = async (locationId: string) => {
    setSelectedLocationId(locationId);
    setAdjustmentType('remove');
    setShowAddForm(true);
  };

  const handleSetQuantity = async (locationId: string) => {
    setSelectedLocationId(locationId);
    setAdjustmentType('set');
    setShowAddForm(true);
  };

  if (!itemId || !itemName) return null;

  const activeLocations = locations.filter(loc => loc.is_active);
  const locationsWithStock = locationBalances.filter(balance => balance.on_hand > 0);
  const totalStock = locationBalances.reduce((sum, balance) => sum + balance.on_hand, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Location Inventory: {itemName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{totalStock}</p>
                <p className="text-sm text-muted-foreground">Total Stock</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{locationsWithStock.length}</p>
                <p className="text-sm text-muted-foreground">Locations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{activeLocations.length}</p>
                <p className="text-sm text-muted-foreground">Available Locations</p>
              </CardContent>
            </Card>
          </div>

          {/* Add/Adjust Form */}
          {showAddForm && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">
                  {adjustmentType === 'add' ? 'Add Stock' : 
                   adjustmentType === 'remove' ? 'Remove Stock' : 'Set Stock Level'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {location.name} ({location.type})
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="quantity">
                      {adjustmentType === 'set' ? 'New Quantity' : 'Quantity'}
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
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
                    placeholder="e.g., Stock received, Used on job, Damaged"
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
                    onClick={handleStockAdjustment}
                    disabled={createStockAdjustment.isPending || !reason || !selectedLocationId}
                  >
                    {createStockAdjustment.isPending ? "Processing..." : 
                     adjustmentType === 'add' ? 'Add Stock' :
                     adjustmentType === 'remove' ? 'Remove Stock' : 'Set Stock'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Stock by Location */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Stock by Location</h3>
              {!showAddForm && (
                <Button 
                  size="sm" 
                  onClick={() => {
                    setAdjustmentType('add');
                    setSelectedLocationId('');
                    setShowAddForm(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Location
                </Button>
              )}
            </div>

            {/* Locations with stock */}
            {locationsWithStock.map((balance) => {
              const location = locations.find(loc => loc.id === balance.location_id);
              if (!location) return null;

              return (
                <Card key={balance.location_id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{location.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {location.type}
                            </Badge>
                            {balance.on_hand <= 5 && (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Low Stock
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-semibold">{balance.on_hand}</p>
                          <p className="text-sm text-muted-foreground">units</p>
                        </div>
                        
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleAddToLocation(balance.location_id)}
                            title="Add stock"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRemoveFromLocation(balance.location_id)}
                            title="Remove stock"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleSetQuantity(balance.location_id)}
                            title="Set exact quantity"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Locations without stock */}
            {activeLocations
              .filter(location => !locationBalances.some(balance => balance.location_id === location.id))
              .map((location) => (
                <Card key={location.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-muted-foreground">{location.name}</p>
                          <Badge variant="outline" className="text-xs">
                            {location.type}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-semibold text-muted-foreground">0</p>
                          <p className="text-sm text-muted-foreground">units</p>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleAddToLocation(location.id)}
                          title="Add stock to this location"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            }

            {activeLocations.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Active Locations</h3>
                  <p className="text-muted-foreground">
                    Create locations first to manage inventory across different sites.
                  </p>
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