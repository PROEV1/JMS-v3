import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Scan, X, Zap, Plus, Trash2, Camera, Keyboard } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BrowserMultiFormatReader } from '@zxing/library';

interface ScannedCharger {
  id: string;
  serialNumber: string;
  chargerModel: string;
  chargerItemId: string;
  status: string;
}

interface ScanChargersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScanChargersModal({ open, onOpenChange }: ScanChargersModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentSerial, setCurrentSerial] = useState('');
  const [selectedChargerModel, setSelectedChargerModel] = useState('');
  const [scannedChargers, setScannedChargers] = useState<ScannedCharger[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanMode, setScanMode] = useState<'manual' | 'camera'>('manual');
  const [isScanning, setIsScanning] = useState(false);
  const serialInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Initialize camera scanner
  useEffect(() => {
    if (open && scanMode === 'camera') {
      initializeScanner();
    }
    return () => {
      stopScanner();
    };
  }, [open, scanMode]);

  const initializeScanner = async () => {
    try {
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      if (videoRef.current) {
        setIsScanning(true);
        console.log('Starting camera scanner...');
        
        await codeReaderRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, error) => {
            if (result) {
              console.log('Scanned result:', result.getText());
              const scannedText = result.getText();
              handleScanResult(scannedText);
            }
            if (error && !(error.name === 'NotFoundException')) {
              console.error('Scanner error:', error);
            }
          }
        );
      }
    } catch (error) {
      console.error('Error initializing scanner:', error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions or use manual entry.",
        variant: "destructive"
      });
      setScanMode('manual');
    }
  };

  const stopScanner = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setIsScanning(false);
  };

  const handleScanResult = (scannedText: string) => {
    // Check if serial already exists
    if (scannedChargers.some(c => c.serialNumber === scannedText)) {
      toast({
        title: "Duplicate Serial",
        description: "This serial number has already been scanned",
        variant: "destructive"
      });
      return;
    }

    // If no charger model selected, just set the serial for manual selection
    if (!selectedChargerModel) {
      setCurrentSerial(scannedText);
      toast({
        title: "Serial Scanned",
        description: `Scanned: ${scannedText}. Please select a charger model.`,
      });
      return;
    }

    const selectedModel = chargerModels.find(m => m.id === selectedChargerModel);
    if (!selectedModel) return;

    const newScannedCharger: ScannedCharger = {
      id: `temp-${Date.now()}-${Math.random()}`,
      serialNumber: scannedText,
      chargerModel: selectedModel.name,
      chargerItemId: selectedModel.id,
      status: 'available'
    };

    setScannedChargers([...scannedChargers, newScannedCharger]);
    setCurrentSerial('');

    toast({
      title: "Charger Added",
      description: `Added ${selectedModel.name} - ${scannedText}`,
    });
  };

  // Fetch charger models
  const { data: chargerModels = [] } = useQuery({
    queryKey: ['charger-models'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku')
        .eq('is_charger', true)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Add scanned charger to preview list
  const handleAddScannedCharger = () => {
    if (!currentSerial.trim()) {
      toast({
        title: "Error",
        description: "Please enter a serial number",
        variant: "destructive"
      });
      return;
    }

    if (!selectedChargerModel) {
      toast({
        title: "Error", 
        description: "Please select a charger model",
        variant: "destructive"
      });
      return;
    }

    // Check if serial already exists in scanned list
    if (scannedChargers.some(c => c.serialNumber === currentSerial.trim())) {
      toast({
        title: "Duplicate Serial",
        description: "This serial number has already been scanned",
        variant: "destructive"
      });
      return;
    }

    const selectedModel = chargerModels.find(m => m.id === selectedChargerModel);
    if (!selectedModel) return;

    const newScannedCharger: ScannedCharger = {
      id: `temp-${Date.now()}-${Math.random()}`,
      serialNumber: currentSerial.trim(),
      chargerModel: selectedModel.name,
      chargerItemId: selectedModel.id,
      status: 'available'
    };

    setScannedChargers([...scannedChargers, newScannedCharger]);
    setCurrentSerial('');
    
    // Focus back to serial input for next scan
    setTimeout(() => {
      serialInputRef.current?.focus();
    }, 100);

    toast({
      title: "Charger Added",
      description: `Added ${selectedModel.name} - ${currentSerial.trim()}`,
    });
  };

  // Remove charger from preview list
  const handleRemoveScannedCharger = (id: string) => {
    setScannedChargers(scannedChargers.filter(c => c.id !== id));
  };

  // Submit all scanned chargers
  const submitChargersMutation = useMutation({
    mutationFn: async () => {
      if (scannedChargers.length === 0) {
        throw new Error('No chargers to submit');
      }

      const chargersToInsert = scannedChargers.map(charger => ({
        charger_item_id: charger.chargerItemId,
        serial_number: charger.serialNumber,
        status: charger.status
      }));

      const { error } = await supabase
        .from('charger_inventory')
        .insert(chargersToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Successfully added ${scannedChargers.length} charger(s) to inventory`,
      });
      queryClient.invalidateQueries({ queryKey: ['charger-items'] });
      setScannedChargers([]);
      setCurrentSerial('');
      setSelectedChargerModel('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add chargers",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    setIsSubmitting(true);
    submitChargersMutation.mutate();
    setIsSubmitting(false);
  };

  const handleClose = () => {
    stopScanner();
    setScannedChargers([]);
    setCurrentSerial('');
    setSelectedChargerModel('');
    setScanMode('manual');
    onOpenChange(false);
  };

  const handleSerialKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddScannedCharger();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="w-5 h-5" />
            Scan Chargers
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Mode Selection */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2 mb-4">
                <Button
                  variant={scanMode === 'camera' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScanMode('camera')}
                  className="flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Camera Scan
                </Button>
                <Button
                  variant={scanMode === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScanMode('manual')}
                  className="flex items-center gap-2"
                >
                  <Keyboard className="w-4 h-4" />
                  Manual Entry
                </Button>
              </div>

              {/* Charger Model Selection (always visible) */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Charger Model</label>
                <Select value={selectedChargerModel} onValueChange={setSelectedChargerModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select charger model first" />
                  </SelectTrigger>
                  <SelectContent>
                    {chargerModels.map(model => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Camera Scanning Mode */}
              {scanMode === 'camera' && (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted
                    />
                     {!isScanning && (
                       <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                         <p className="text-white text-center">
                           Starting camera...
                         </p>
                       </div>
                     )}
                     {isScanning && (
                       <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                         📷 Ready to scan
                       </div>
                     )}
                     {currentSerial && (
                       <div className="absolute bottom-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                         Scanned: {currentSerial}
                       </div>
                     )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>💡 <strong>Camera Tip:</strong> Point your camera at any QR code or barcode. You can scan first, then select the charger model, or select the model first for automatic adding.</p>
                  </div>
                  
                  {/* Quick Add Section - when serial is scanned but no model selected */}
                  {currentSerial && !selectedChargerModel && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Scanned: <code className="bg-white px-2 py-1 rounded">{currentSerial}</code></p>
                            <p className="text-sm text-muted-foreground">Select a charger model to add this serial</p>
                          </div>
                          <Button 
                            onClick={handleAddScannedCharger}
                            disabled={!selectedChargerModel}
                            size="sm"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Manual Entry Mode */}
              {scanMode === 'manual' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Serial Number / QR Code</label>
                      <Input
                        ref={serialInputRef}
                        placeholder="Enter serial number"
                        value={currentSerial}
                        onChange={(e) => setCurrentSerial(e.target.value)}
                        onKeyPress={handleSerialKeyPress}
                        className="font-mono"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={handleAddScannedCharger}
                        className="w-full"
                        disabled={!currentSerial.trim() || !selectedChargerModel}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Charger
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>💡 <strong>Manual Tip:</strong> Enter serial numbers manually and press Enter or click "Add Charger" to add each one to the preview list.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview List */}
          {scannedChargers.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Scanned Chargers Preview</h3>
                  <Badge variant="secondary">{scannedChargers.length} charger(s)</Badge>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Charger Model</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scannedChargers.map(charger => (
                      <TableRow key={charger.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-primary/10 rounded">
                              <Zap className="w-3 h-3 text-primary" />
                            </div>
                            <span className="font-medium">{charger.chargerModel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {charger.serialNumber}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{charger.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveScannedCharger(charger.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={scannedChargers.length === 0 || isSubmitting || submitChargersMutation.isPending}
          >
            {submitChargersMutation.isPending ? 'Adding...' : `Add ${scannedChargers.length} Charger(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}