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
  chargerModel?: string;
  chargerItemId?: string;
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
  const [scannedChargers, setScannedChargers] = useState<ScannedCharger[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanMode, setScanMode] = useState<'manual' | 'camera'>('manual');
  const [isScanning, setIsScanning] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
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

  // Check database for existing serial number
  const checkSerialInDatabase = async (serialNumber: string) => {
    const { data, error } = await supabase
      .from('charger_inventory')
      .select(`
        id,
        serial_number,
        status,
        location_id,
        engineer_id,
        inventory_locations(name),
        engineers!engineer_id(name)
      `)
      .eq('serial_number', serialNumber)
      .maybeSingle();

    if (error) {
      console.error('Error checking serial:', error);
      return null;
    }

    return data;
  };

  const handleScanResult = async (scannedText: string) => {
    // Check if serial already exists in current session
    if (scannedChargers.some(c => c.serialNumber === scannedText)) {
      toast({
        title: "Duplicate Serial",
        description: "This serial number has already been scanned in this session",
        variant: "destructive"
      });
      return;
    }

    // Check database for existing serial number
    setIsCheckingDuplicate(true);
    try {
      const existingCharger = await checkSerialInDatabase(scannedText);
      
      if (existingCharger) {
        const locationName = existingCharger.inventory_locations?.name || 'Unknown location';
        const engineerName = existingCharger.engineers?.name || 'Unassigned';
        
        toast({
          title: "Serial Already in System",
          description: `Serial ${scannedText} already exists (Status: ${existingCharger.status}, Location: ${locationName}, Engineer: ${engineerName})`,
          variant: "destructive"
        });
        setIsCheckingDuplicate(false);
        return;
      }

      // Auto-add scanned serial to the list
      const newScannedCharger: ScannedCharger = {
        id: `temp-${Date.now()}-${Math.random()}`,
        serialNumber: scannedText,
        status: 'available'
      };

      setScannedChargers(prev => [...prev, newScannedCharger]);
      setCurrentSerial('');

      toast({
        title: "Serial Added",
        description: `Added serial: ${scannedText}`,
      });
    } catch (error) {
      console.error('Error checking duplicate:', error);
      toast({
        title: "Error",
        description: "Could not verify serial number. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCheckingDuplicate(false);
    }
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

  // Update charger model for a specific charger
  const handleUpdateChargerModel = (chargerId: string, modelId: string) => {
    const selectedModel = chargerModels.find(m => m.id === modelId);
    if (!selectedModel) return;

    setScannedChargers(prev => prev.map(charger => 
      charger.id === chargerId 
        ? { 
            ...charger, 
            chargerModel: selectedModel.name,
            chargerItemId: selectedModel.id
          }
        : charger
    ));
  };

  // Remove charger from preview list
  const handleRemoveScannedCharger = (id: string) => {
    setScannedChargers(prev => prev.filter(c => c.id !== id));
  };

  // Apply charger model to all unassigned chargers
  const handleSelectAllChargerModel = (modelId: string) => {
    const selectedModel = chargerModels.find(m => m.id === modelId);
    if (!selectedModel) return;

    setScannedChargers(prev => prev.map(charger => 
      !charger.chargerItemId 
        ? { 
            ...charger, 
            chargerModel: selectedModel.name,
            chargerItemId: selectedModel.id
          }
        : charger
    ));

    const unassignedCount = scannedChargers.filter(c => !c.chargerItemId).length;
    toast({
      title: "Bulk Assignment Complete",
      description: `Applied ${selectedModel.name} to ${unassignedCount} charger(s)`,
    });
  };

  // Clear all charger model assignments
  const handleClearAllAssignments = () => {
    setScannedChargers(prev => prev.map(charger => ({
      ...charger,
      chargerModel: undefined,
      chargerItemId: undefined
    })));

    toast({
      title: "Assignments Cleared",
      description: "All charger model assignments have been cleared",
    });
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
    // Check if all chargers have models assigned
    const chargersWithoutModels = scannedChargers.filter(c => !c.chargerItemId);
    if (chargersWithoutModels.length > 0) {
      toast({
        title: "Missing Charger Models",
        description: `Please assign charger models to all ${chargersWithoutModels.length} chargers before submitting.`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    submitChargersMutation.mutate();
    setIsSubmitting(false);
  };

  const handleClose = () => {
    stopScanner();
    setScannedChargers([]);
    setCurrentSerial('');
    setScanMode('manual');
    onOpenChange(false);
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
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>💡 <strong>Camera Tip:</strong> Point your camera at any QR code or barcode. Serials will be added automatically to the list below.</p>
                  </div>
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
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (currentSerial.trim() && !isCheckingDuplicate) {
                              handleScanResult(currentSerial.trim());
                            }
                          }
                        }}
                        disabled={isCheckingDuplicate}
                        className="font-mono"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={() => {
                          if (currentSerial.trim() && !isCheckingDuplicate) {
                            handleScanResult(currentSerial.trim());
                          }
                        }}
                        className="w-full"
                        disabled={!currentSerial.trim() || isCheckingDuplicate}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {isCheckingDuplicate ? 'Checking...' : 'Add Serial'}
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>💡 <strong>Manual Tip:</strong> Enter serial numbers and press Enter or click "Add Serial" to add them to the list below.</p>
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

                 {/* Bulk Assignment Section */}
                 <div className="mb-4 p-3 bg-muted/30 rounded-lg border">
                   <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                     <div className="flex-1">
                       <label className="text-sm font-medium mb-2 block">Bulk Assign Charger Model:</label>
                       <Select onValueChange={handleSelectAllChargerModel}>
                         <SelectTrigger className="w-full sm:w-[250px]">
                           <SelectValue placeholder="Select model to apply to all..." />
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
                     <div className="flex gap-2">
                       <Button 
                         variant="outline" 
                         size="sm"
                         onClick={handleClearAllAssignments}
                         disabled={!scannedChargers.some(c => c.chargerItemId)}
                       >
                         Clear All
                       </Button>
                     </div>
                   </div>
                   <div className="text-xs text-muted-foreground mt-2">
                     💡 Use bulk assign to quickly apply the same charger model to all unassigned serials
                   </div>
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
                         {charger.chargerModel ? (
                           <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-primary/10 rounded">
                               <Zap className="w-3 h-3 text-primary" />
                             </div>
                             <span className="font-medium">{charger.chargerModel}</span>
                           </div>
                         ) : (
                           <Select onValueChange={(value) => handleUpdateChargerModel(charger.id, value)}>
                             <SelectTrigger className="w-[200px]">
                               <SelectValue placeholder="Select model..." />
                             </SelectTrigger>
                             <SelectContent>
                               {chargerModels.map(model => (
                                 <SelectItem key={model.id} value={model.id}>
                                   {model.name}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         )}
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