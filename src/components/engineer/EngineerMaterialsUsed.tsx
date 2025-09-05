import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, X, AlertCircle } from "lucide-react";
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
  
  const [itemName, setItemName] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedChargerId, setSelectedChargerId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [serialNumber, setSerialNumber] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [deductStock, setDeductStock] = useState(true);

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

  // Fetch assigned chargers for this engineer
  const { data: assignedChargers = [] } = useQuery({
    queryKey: ['assigned-chargers', engineerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charger_inventory')
        .select(`
          id,
          serial_number,
          status,
          notes,
          charger_item_id,
          inventory_items:charger_item_id (
            name,
            sku
          )
        `)
        .eq('engineer_id', engineerId)
        .eq('status', 'assigned')
        .order('serial_number');
      
      if (error) throw error;
      return data;
    }
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
    setSelectedChargerId(""); // Clear charger selection
    const selectedItem = inventoryItems.find(item => item.id === itemId);
    if (selectedItem) {
      setItemName(selectedItem.name);
      setLocationId(engineerLocation?.id || "");
    }
  };

  const handleChargerSelect = (chargerId: string) => {
    setSelectedChargerId(chargerId);
    setSelectedItemId(""); // Clear item selection
    const selectedCharger = assignedChargers.find(charger => charger.id === chargerId);
    if (selectedCharger) {
      setItemName(selectedCharger.inventory_items?.name || "EV Charger");
      setSerialNumber(selectedCharger.serial_number || "");
      setLocationId(engineerLocation?.id || "");
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
    setSelectedChargerId("");
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
      <CardContent className="space-y-6">
        {/* Add Material Form */}
        <div className="border rounded-lg p-4 space-y-4 bg-background/50">
          <h4 className="font-medium text-sm">Add Material</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="material-select">Van Inventory</Label>
              <Select value={selectedItemId} onValueChange={handleItemSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose from van stock..." />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>Available Stock</SelectLabel>
                      {inventoryItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.sku}) - {item.on_hand} available
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

            <div className="space-y-2">
              <Label htmlFor="charger-select">Assigned Chargers</Label>
              <Select value={selectedChargerId} onValueChange={handleChargerSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose assigned charger..." />
                </SelectTrigger>
                <SelectContent>
                  {assignedChargers.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>Your Chargers</SelectLabel>
                      {assignedChargers.map((charger) => (
                        <SelectItem key={charger.id} value={charger.id}>
                          {charger.inventory_items?.name || "EV Charger"} - {charger.serial_number}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : (
                    <SelectItem value="none" disabled>
                      No chargers assigned
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="material-name">Or Enter Custom Item *</Label>
              <Input
                id="material-name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Cable (5m), Mounting Kit"
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial">Serial Number</Label>
              <Input
                id="serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="If applicable"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} {location.code && `(${location.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="deduct-stock"
                checked={deductStock}
                onChange={(e) => setDeductStock(e.target.checked)}
                disabled={!locationId}
                className="rounded border-input"
              />
              <Label htmlFor="deduct-stock" className="text-sm">
                Deduct from inventory
                {!locationId && <span className="text-muted-foreground"> (requires location)</span>}
              </Label>
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={!itemName.trim() || recordMaterialMutation.isPending}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Material
            </Button>
          </div>
        </div>

        {/* Materials List */}
        {materialsUsed.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Materials Used ({materialsUsed.length})</h4>
            <div className="space-y-2">
              {materialsUsed.map((material) => (
                <div key={material.id} className="flex items-center justify-between p-3 border rounded-lg bg-background/30">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{material.item_name}</span>
                      {material.inventory_items && (
                        <Badge variant="secondary" className="text-xs">
                          {material.inventory_items.sku}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Qty: {material.quantity}</span>
                      {material.serial_number && <span>Serial: {material.serial_number}</span>}
                      {material.inventory_locations && (
                        <span>Location: {material.inventory_locations.name}</span>
                      )}
                      {material.notes && <span>Notes: {material.notes}</span>}
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Material</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove "{material.item_name}" from this job?
                          {material.location_id && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
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
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-primary font-medium mb-1">Material Tracking</p>
              <p className="text-muted-foreground">
                Select items from your van stock, assigned chargers, or add custom materials. 
                Items from van stock can be automatically deducted when used.
              </p>
              {!engineerLocation && (
                <p className="text-amber-600 mt-1 font-medium">
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