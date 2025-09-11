import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Package, Plus, X, AlertCircle, List, CheckSquare } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMaterialsUsed, useRecordMaterialUsage, useRevokeMaterialUsage } from '@/hooks/useMaterialsUsed';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface EngineerMaterialsUsedProps {
  orderId: string;
  engineerId: string;
}

export function EngineerMaterialsUsed({ orderId, engineerId }: EngineerMaterialsUsedProps) {
  console.log('EngineerMaterialsUsed: Component mounted with orderId:', orderId, 'engineerId:', engineerId);
  console.log('DEBUG: Using individual item quantities');
  
  // Single item form state
  const [itemName, setItemName] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [serialNumber, setSerialNumber] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [deductStock, setDeductStock] = useState(true);

  // Multi-select mode state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [multiSelectLocationId, setMultiSelectLocationId] = useState<string>("");
  const [multiSelectNotes, setMultiSelectNotes] = useState("");
  const [multiSelectDeductStock, setMultiSelectDeductStock] = useState(true);

  const { data: materialsUsed = [], isLoading } = useMaterialsUsed(orderId);
  const recordMaterialMutation = useRecordMaterialUsage();
  const revokeMaterialMutation = useRevokeMaterialUsage();

  // Fetch engineer's van location to get available inventory
  const { data: engineerLocation } = useQuery({
    queryKey: ['engineer-location', engineerId],
    queryFn: async () => {
      console.log('🔍 ENGINEER LOCATION QUERY: Starting for engineer:', engineerId);
      
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name, code')
        .eq('engineer_id', engineerId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) {
        console.error('❌ ENGINEER LOCATION ERROR:', error);
        throw error;
      }
      
      console.log('✅ ENGINEER LOCATION RESULT:', data);
      console.log('🎯 Location ID found:', data?.id);
      return data;
    },
    enabled: !!engineerId
  });

  // Fetch inventory items available in engineer's van using same method as Van Inventory
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['engineer-inventory-items', engineerLocation?.id],
    queryFn: async () => {
      if (!engineerLocation?.id) {
        console.log('🚫 NO LOCATION: Skipping inventory fetch - no location found');
        return [];
      }
      
      console.log('📦 INVENTORY QUERY: Starting for location:', engineerLocation.id, engineerLocation.name);
      
      // Use same RPC method as Van Inventory for consistency
      const { data: balances, error: balancesError } = await supabase
        .rpc('get_item_location_balances');
      
      if (balancesError) {
        console.error('❌ INVENTORY BALANCES ERROR:', balancesError);
        throw balancesError;
      }
      
      console.log('📦 ALL BALANCES:', balances);
      
      // Filter balances for this engineer's location
      const engineerBalances = balances?.filter(balance => 
        balance.location_id === engineerLocation.id && balance.on_hand > 0
      ) || [];
      
      console.log('📦 ENGINEER BALANCES:', engineerBalances);
      
      if (engineerBalances.length === 0) {
        console.log('📦 NO STOCK: No items with positive stock found');
        return [];
      }
      
      // Get item details
      const itemIds = engineerBalances.map(balance => balance.item_id);
      console.log('🔎 FETCHING ITEM DETAILS for IDs:', itemIds);
      
      const { data: itemDetails, error: itemError } = await supabase
        .from('inventory_items')
        .select('id, name, sku, is_serialized')
        .in('id', itemIds)
        .eq('is_active', true)
        .order('name');
      
      if (itemError) {
        console.error('❌ ITEM DETAILS ERROR:', itemError);
        throw itemError;
      }
      
      console.log('📝 ITEM DETAILS:', itemDetails);
      
      const result = itemDetails?.map(item => ({
        ...item,
        on_hand: engineerBalances.find(b => b.item_id === item.id)?.on_hand || 0
      })) || [];
      
      console.log('🎯 FINAL INVENTORY RESULT:', result);
      return result;
    },
    enabled: !!engineerLocation?.id
  });


  // Fetch inventory locations
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const selectedItem = inventoryItems.find(item => item.id === itemId);
    if (selectedItem) {
      setItemName(selectedItem.name);
      setLocationId(engineerLocation?.id || "");
    }
  };

  const handleMultiSelectToggle = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId]);
      setItemQuantities(prev => ({ ...prev, [itemId]: 1 })); // Default quantity of 1
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
      setItemQuantities(prev => {
        const newQuantities = { ...prev };
        delete newQuantities[itemId];
        return newQuantities;
      });
    }
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setItemQuantities(prev => ({ ...prev, [itemId]: Math.max(1, quantity) }));
  };

  const handleMultiSelectSubmit = async () => {
    if (selectedItems.length === 0) return;

    const promises = selectedItems.map(itemId => {
      const item = inventoryItems.find(i => i.id === itemId);
      if (!item) return Promise.resolve();

      const quantity = itemQuantities[itemId] || 1;

      return new Promise((resolve, reject) => {
        recordMaterialMutation.mutate({
          orderId,
          engineerId,
          itemId,
          itemName: item.name,
          quantity,
          serialNumber: undefined, // Multi-select doesn't support individual serial numbers
          locationId: multiSelectLocationId || undefined,
          notes: multiSelectNotes || undefined,
          deductStock: multiSelectDeductStock && !!multiSelectLocationId
        }, {
          onSuccess: resolve,
          onError: reject
        });
      });
    });

    try {
      await Promise.all(promises);
      // Reset multi-select form
      setSelectedItems([]);
      setItemQuantities({});
      setMultiSelectLocationId("");
      setMultiSelectNotes("");
      setMultiSelectDeductStock(true);
    } catch (error) {
      console.error('Error submitting multiple materials:', error);
    }
  };

  const handleSubmit = () => {
    if (!itemName.trim()) return;

    recordMaterialMutation.mutate({
      orderId,
      engineerId,
      itemId: selectedItemId || undefined,
      itemName,
      quantity,
      serialNumber: serialNumber || undefined,
      locationId: locationId || undefined,
      notes: notes || undefined,
      deductStock: deductStock && !!locationId
    });

    // Reset form
    setItemName("");
    setSelectedItemId("");
    setQuantity(1);
    setSerialNumber("");
    setLocationId("");
    setNotes("");
    setDeductStock(true);
  };

  const handleRevoke = (usageId: string, shouldRestoreStock: boolean) => {
    revokeMaterialMutation.mutate({
      usageId,
      restoreStock: shouldRestoreStock
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Materials Used on Job
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Materials Used on Job
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Mode Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border">
          <div className="flex items-center gap-3">
            <Button
              variant={!isMultiSelectMode ? "default" : "outline"}
              size="default"
              onClick={() => setIsMultiSelectMode(false)}
              className="font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Single Item
            </Button>
            <Button
              variant={isMultiSelectMode ? "default" : "outline"}
              size="default"
              onClick={() => setIsMultiSelectMode(true)}
              className="font-medium"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Multi-Select
            </Button>
          </div>
          {isMultiSelectMode && selectedItems.length > 0 && (
            <Badge variant="default" className="text-sm px-3 py-1">
              {selectedItems.length} item{selectedItems.length === 1 ? '' : 's'} selected
            </Badge>
          )}
        </div>

        {/* Single Item Form */}
        {!isMultiSelectMode && (
          <div className="border rounded-lg p-6 space-y-6 bg-card">
            <h4 className="font-semibold text-lg text-foreground">Add Material</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="material-select" className="text-base font-medium">Van Inventory</Label>
                <Select value={selectedItemId} onValueChange={handleItemSelect}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Choose from van stock..." />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel className="text-sm font-semibold">Available Stock</SelectLabel>
                        {inventoryItems.map((item) => (
                          <SelectItem key={item.id} value={item.id} className="py-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{item.name}</span>
                              <span className="text-sm text-muted-foreground">{item.sku} • {item.on_hand} available</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : (
                      <SelectItem value="none" disabled>
                        No items in van stock
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="material-name" className="text-base font-medium">Or Enter Custom Item *</Label>
                <Input
                  id="material-name"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g., Cable (5m), Mounting Kit"
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label htmlFor="quantity" className="text-base font-medium">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="h-11 text-base"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="serial" className="text-base font-medium">Serial Number</Label>
                <Input
                  id="serial"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="If applicable"
                  className="h-11"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="location" className="text-base font-medium">Location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id} className="py-3">
                        <span className="font-medium">{location.name}</span>
                        {location.code && <span className="text-muted-foreground ml-2">({location.code})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="notes" className="text-base font-medium">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="h-11"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="deduct-stock"
                  checked={deductStock}
                  onCheckedChange={(checked) => setDeductStock(checked as boolean)}
                  disabled={!locationId}
                />
                <Label htmlFor="deduct-stock" className="text-base cursor-pointer">
                  Deduct from inventory
                  {!locationId && <span className="text-muted-foreground ml-1">(requires location)</span>}
                </Label>
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={!itemName.trim() || recordMaterialMutation.isPending}
                size="lg"
                className="px-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Material
              </Button>
            </div>
          </div>
        )}

        {/* Multi-Select Form */}
        {isMultiSelectMode && (
          <div className="border rounded-lg p-6 space-y-6 bg-card">
            <h4 className="font-semibold text-lg text-foreground">Select Multiple Materials</h4>
            
            {/* Item Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Van Inventory Items</Label>
              {inventoryItems.length > 0 ? (
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-3 bg-background/50">
                  {inventoryItems.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4 p-3 hover:bg-muted/30 rounded-lg border border-transparent hover:border-border transition-colors">
                      <Checkbox
                        id={`item-${item.id}`}
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={(checked) => handleMultiSelectToggle(item.id, checked as boolean)}
                        className="scale-110"
                      />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={`item-${item.id}`} className="text-base font-medium cursor-pointer text-foreground">
                          {item.name}
                        </Label>
                        <div className="text-sm text-muted-foreground mt-1">
                          {item.sku} • <span className="font-medium">{item.on_hand} available</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-base">No items available in van stock</p>
                </div>
              )}
            </div>

            {selectedItems.length > 0 && (
              <>
                <Separator />
                
                {/* Selected Items Summary */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Selected Items ({selectedItems.length})</Label>
                  <div className="grid gap-3">
                    {selectedItems.map(itemId => {
                      const item = inventoryItems.find(i => i.id === itemId);
                      return item ? (
                        <div key={itemId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                          <div className="flex-1">
                            <div className="font-medium text-foreground">{item.name}</div>
                            <div className="text-sm text-muted-foreground">{item.sku}</div>
                          </div>
                          <button 
                            onClick={() => handleMultiSelectToggle(itemId, false)}
                            className="ml-3 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Individual Quantity Settings */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Set Quantities</Label>
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {selectedItems.map(itemId => {
                      const item = inventoryItems.find(i => i.id === itemId);
                      if (!item) return null;
                      
                      return (
                        <div key={itemId} className="flex items-center justify-between p-4 border rounded-lg bg-background/50">
                          <div className="flex-1">
                            <div className="font-medium text-base text-foreground">{item.name}</div>
                            <div className="text-sm text-muted-foreground mt-1">{item.sku} • <span className="font-medium">{item.on_hand} available</span></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Label htmlFor={`qty-${itemId}`} className="text-base font-medium">Qty:</Label>
                            <Input
                              id={`qty-${itemId}`}
                              type="number"
                              min="1"
                              max={item.on_hand}
                              value={itemQuantities[itemId] || 1}
                              onChange={(e) => handleQuantityChange(itemId, parseInt(e.target.value) || 1)}
                              className="w-24 text-center h-10 text-base font-medium"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Common Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="multi-location" className="text-base font-medium">Location</Label>
                    <Select value={multiSelectLocationId} onValueChange={setMultiSelectLocationId}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id} className="py-3">
                            <span className="font-medium">{location.name}</span>
                            {location.code && <span className="text-muted-foreground ml-2">({location.code})</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="multi-notes" className="text-base font-medium">Notes (for all)</Label>
                    <Input
                      id="multi-notes"
                      value={multiSelectNotes}
                      onChange={(e) => setMultiSelectNotes(e.target.value)}
                      placeholder="Optional notes"
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="multi-deduct-stock"
                      checked={multiSelectDeductStock}
                      onCheckedChange={(checked) => setMultiSelectDeductStock(checked as boolean)}
                      disabled={!multiSelectLocationId}
                    />
                    <Label htmlFor="multi-deduct-stock" className="text-base cursor-pointer">
                      Deduct from inventory
                      {!multiSelectLocationId && <span className="text-muted-foreground ml-1">(requires location)</span>}
                    </Label>
                  </div>

                  <Button 
                    onClick={handleMultiSelectSubmit} 
                    disabled={selectedItems.length === 0 || recordMaterialMutation.isPending}
                    size="lg"
                    className="px-6"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add {selectedItems.length} Material{selectedItems.length === 1 ? '' : 's'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Materials List */}
        {materialsUsed.length > 0 && (
          <div className="space-y-6">
            <h4 className="font-semibold text-lg text-foreground">Materials Used ({materialsUsed.length})</h4>
            <div className="space-y-4">
              {materialsUsed.map((material) => (
                <div key={material.id} className="flex items-center justify-between p-4 border rounded-lg bg-card shadow-sm">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-base text-foreground">{material.item_name}</span>
                      {material.inventory_items && (
                        <Badge variant="default" className="text-sm px-2 py-1">
                          {material.inventory_items.sku}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="font-medium">Qty: {material.quantity}</span>
                      {material.serial_number && <span><span className="font-medium">Serial:</span> {material.serial_number}</span>}
                      {material.inventory_locations && (
                        <span><span className="font-medium">Location:</span> {material.inventory_locations.name}</span>
                      )}
                      {material.notes && <span><span className="font-medium">Notes:</span> {material.notes}</span>}
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg">Remove Material</AlertDialogTitle>
                        <AlertDialogDescription className="text-base">
                          Are you sure you want to remove "{material.item_name}" from this job?
                          {material.location_id && (
                            <div className="mt-3 p-3 bg-muted rounded text-sm">
                              <strong>Stock restoration:</strong> This material was deducted from inventory. 
                              You can choose to restore the stock or leave it as consumed.
                            </div>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(material.id, true)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Remove & Restore Stock
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Message */}
        <div className="bg-primary/5 border border-primary/20 p-6 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-primary font-semibold mb-2 text-base">Material Tracking</p>
              <p className="text-muted-foreground text-base leading-relaxed">
                Select items from your van stock or add custom materials. Items from van stock can be automatically deducted when used.
              </p>
              {!engineerLocation && (
                <p className="text-amber-600 mt-3 font-medium text-base">
                  ⚠️ No van location found - contact admin to set up your van stock location.
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}