import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Scan, Package, PackageCheck, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EngineerScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vanLocationId: string;
  vanLocationName: string;
}

type ScanMode = 'receive' | 'manual_add';

export function EngineerScanModal({ open, onOpenChange, vanLocationId, vanLocationName }: EngineerScanModalProps) {
  const [scanMode, setScanMode] = useState<ScanMode>('receive');
  const [scannedCode, setScannedCode] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch inventory items for manual selection
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory-items-for-scan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku, unit')
        .eq('is_active', true)
        .eq('is_charger', false)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Add stock mutation
  const addStockMutation = useMutation({
    mutationFn: async ({ itemId, qty, reference, scanNotes }: {
      itemId: string;
      qty: number;
      reference: string;
      scanNotes: string;
    }) => {
      const { error } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: itemId,
          location_id: vanLocationId,
          direction: 'in',
          qty: qty,
          reference: reference,
          notes: scanNotes,
          status: 'approved' // Engineers can approve their own van additions
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Stock Added Successfully",
        description: `Added ${quantity} units to van inventory`,
      });

      // Invalidate queries to refresh van stock
      queryClient.invalidateQueries({ queryKey: ['van-stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['van-stock-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['van-recent-transactions'] });

      // Reset form
      setScannedCode('');
      setSelectedItemId('');
      setQuantity('1');
      setNotes('');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error adding stock:', error);
      toast({
        title: "Error Adding Stock",
        description: "Failed to add stock. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleScan = () => {
    if (scanMode === 'receive' && !scannedCode.trim()) {
      toast({
        title: "No code entered",
        description: "Please enter or scan a barcode",
        variant: "destructive"
      });
      return;
    }

    if (scanMode === 'manual_add' && !selectedItemId) {
      toast({
        title: "No item selected",
        description: "Please select an item to add",
        variant: "destructive"
      });
      return;
    }

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid quantity",
        variant: "destructive"
      });
      return;
    }

    let itemId = selectedItemId;
    let reference = '';

    if (scanMode === 'receive') {
      // TODO: In a real implementation, you'd look up the item by barcode/SKU
      // For now, we'll show an error if no item is selected for manual mode
      toast({
        title: "Feature Not Implemented",
        description: "Barcode scanning is not yet implemented. Please use manual add instead.",
        variant: "destructive"
      });
      return;
    } else {
      reference = `Manual addition to van - ${vanLocationName}`;
    }

    addStockMutation.mutate({
      itemId,
      qty,
      reference,
      scanNotes: notes || `Added via scan interface in ${scanMode} mode`
    });
  };

  const handleQuickAdd = (itemId: string, itemName: string) => {
    setSelectedItemId(itemId);
    setQuantity('1');
    setNotes(`Quick add: ${itemName}`);
  };

  const scanModes = [
    {
      value: 'receive' as ScanMode,
      label: 'Scan Barcode',
      icon: Scan,
      description: 'Scan items by barcode/SKU',
      color: 'text-green-600'
    },
    {
      value: 'manual_add' as ScanMode,
      label: 'Manual Add',
      icon: Package,
      description: 'Manually select items to add',
      color: 'text-blue-600'
    }
  ];

  const currentMode = scanModes.find(mode => mode.value === scanMode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Add Stock to Van
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Selection */}
          <div className="grid gap-4 md:grid-cols-2">
            {scanModes.map((mode) => {
              const IconComponent = mode.icon;
              return (
                <div 
                  key={mode.value}
                  className={`cursor-pointer p-4 border rounded-lg transition-all ${
                    scanMode === mode.value 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:bg-muted/30'
                  }`}
                  onClick={() => setScanMode(mode.value)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <IconComponent className={`h-5 w-5 ${mode.color}`} />
                    <span className="font-medium">{mode.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {mode.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            {scanMode === 'receive' ? (
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode / SKU</Label>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    value={scannedCode}
                    onChange={(e) => setScannedCode(e.target.value)}
                    placeholder="Scan or type barcode..."
                    className="flex-1"
                  />
                  <Button variant="outline" disabled>
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Camera scanning not yet implemented
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="item">Select Item</Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an item to add" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {inventoryItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Adding to</Label>
                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{vanLocationName}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>

            <Button 
              onClick={handleScan} 
              className="w-full"
              disabled={addStockMutation.isPending}
            >
              {addStockMutation.isPending ? 'Adding...' : `Add to Van Stock`}
            </Button>
          </div>

          {scanMode === 'manual_add' && inventoryItems.length > 0 && (
            <div className="space-y-3">
              <Label>Quick Add Common Items</Label>
              <div className="grid gap-2">
                {inventoryItems.slice(0, 4).map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    onClick={() => handleQuickAdd(item.id, item.name)}
                    className="justify-start text-left h-auto p-3"
                  >
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.sku}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}