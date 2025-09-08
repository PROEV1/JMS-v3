import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Scan, Package, PackageCheck, Camera, X } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
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
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader>();

  // Initialize barcode scanner
  useEffect(() => {
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader();
    }
    
    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, []);

  // Cleanup camera when modal closes or scanning stops
  useEffect(() => {
    if (!open || !isScanning) {
      stopScanning();
    }
  }, [open, isScanning]);

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

  const startScanning = async () => {
    try {
      setIsScanning(true);
      
      // First check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device/browser');
      }

      // Check for HTTPS requirement
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('Camera access requires HTTPS');
      }

      // Request camera permission first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment' // Use back camera if available
          } 
        });
        
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
      } catch (permissionError) {
        console.error('Camera permission error:', permissionError);
        throw new Error('Camera permission denied. Please allow camera access and try again.');
      }
      
      if (!videoRef.current || !readerRef.current) {
        throw new Error('Video element or reader not available');
      }

      await readerRef.current.decodeFromVideoDevice(
        undefined, // Use default camera
        videoRef.current,
        (result, error) => {
          if (result) {
            // Successfully scanned a barcode
            const scannedText = result.getText();
            setScannedCode(scannedText);
            setIsScanning(false);
            
            // Try to find matching item by SKU
            const matchingItem = inventoryItems.find(item => 
              item.sku?.toLowerCase() === scannedText.toLowerCase()
            );
            
            if (matchingItem) {
              setSelectedItemId(matchingItem.id);
              setScanMode('manual_add');
              toast({
                title: "Item Found",
                description: `Found: ${matchingItem.name}`,
              });
            } else {
              toast({
                title: "Barcode Scanned",
                description: `Code: ${scannedText}. No matching item found, please select manually.`,
              });
            }
          }
          
          if (error && error.name !== 'NotFoundException') {
            console.error('Scanning error:', error);
          }
        }
      );
    } catch (error) {
      console.error('Failed to start camera:', error);
      setIsScanning(false);
      
      let errorMessage = "Unable to access camera.";
      
      if (error.message.includes('permission')) {
        errorMessage = "Camera permission denied. Please allow camera access in your browser settings and try again.";
      } else if (error.message.includes('HTTPS')) {
        errorMessage = "Camera access requires HTTPS. Please use a secure connection.";
      } else if (error.message.includes('not supported')) {
        errorMessage = "Camera not supported on this device or browser.";
      }
      
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const stopScanning = () => {
    if (readerRef.current) {
      readerRef.current.reset();
    }
    setIsScanning(false);
  };

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
      // Look up item by the scanned code/SKU
      const matchingItem = inventoryItems.find(item => 
        item.sku?.toLowerCase() === scannedCode.toLowerCase()
      );
      
      if (!matchingItem) {
        toast({
          title: "Item Not Found",
          description: `No item found with SKU: ${scannedCode}. Please check the code or use manual add.`,
          variant: "destructive"
        });
        return;
      }
      
      itemId = matchingItem.id;
      reference = `Scanned addition to van - ${vanLocationName} (SKU: ${scannedCode})`;
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Scan className="h-5 w-5 text-primary" />
            </div>
            Add Stock to Van
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Scan barcodes or manually add items to your van inventory
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select Method</Label>
            <div className="grid gap-3 md:grid-cols-2">
              {scanModes.map((mode) => {
                const IconComponent = mode.icon;
                const isSelected = scanMode === mode.value;
                return (
                  <div 
                    key={mode.value}
                    className={`cursor-pointer group relative overflow-hidden rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                      isSelected 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }`}
                    onClick={() => setScanMode(mode.value)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {mode.label}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {mode.description}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="h-2 w-2 rounded-full bg-primary"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Input Section */}
          <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
            {scanMode === 'receive' ? (
              <div className="space-y-3">
                <Label htmlFor="barcode" className="flex items-center gap-2">
                  <Scan className="h-4 w-4 text-primary" />
                  Barcode / SKU
                </Label>
                {isScanning ? (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-lg bg-black">
                      <video 
                        ref={videoRef}
                        className="w-full h-48 object-cover"
                        autoPlay
                        muted
                        playsInline
                      />
                      <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-lg pointer-events-none flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-white text-sm font-medium mb-1">Position barcode here</div>
                          <div className="text-white/70 text-xs">Hold steady for scanning</div>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={stopScanning}
                      className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Stop Camera
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        id="barcode"
                        value={scannedCode}
                        onChange={(e) => setScannedCode(e.target.value)}
                        placeholder="Type or scan barcode..."
                        className="flex-1 h-11"
                      />
                      <Button 
                        variant="outline" 
                        onClick={startScanning}
                        disabled={isScanning}
                        className="h-11 px-4 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                        <Camera className="h-4 w-4" />
                        Camera Tips
                      </div>
                      <div className="text-xs text-blue-600 space-y-1">
                        <p>• Ensure good lighting for best results</p>
                        <p>• Allow camera permissions when prompted</p>
                        <p>• Refresh page if camera fails to start</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Label htmlFor="item" className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Select Item
                </Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Choose an item to add" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {inventoryItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex flex-col gap-1">
                          <span>{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.sku}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-sm font-medium">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Location</Label>
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <Package className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">{vanLocationName}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">Notes (optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                className="h-11"
              />
            </div>
          </div>

          {/* Action Button */}
          <Button 
            onClick={handleScan} 
            className="w-full h-12 text-base font-medium"
            disabled={addStockMutation.isPending}
          >
            {addStockMutation.isPending ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                Adding Stock...
              </>
            ) : (
              <>
                <PackageCheck className="h-4 w-4 mr-2" />
                Add to Van Stock
              </>
            )}
          </Button>

          {/* Quick Add Section */}
          {scanMode === 'manual_add' && inventoryItems.length > 0 && (
            <div className="space-y-4 rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                  <Package className="h-3 w-3 text-blue-600" />
                </div>
                <Label className="text-sm font-medium text-blue-900">Quick Add Common Items</Label>
              </div>
              <div className="grid gap-2">
                {inventoryItems.slice(0, 4).map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    onClick={() => handleQuickAdd(item.id, item.name)}
                    className="justify-start text-left h-auto p-3 border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                        <Package className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-foreground">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </div>
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