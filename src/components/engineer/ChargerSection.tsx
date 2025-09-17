import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Plus, X, Scan, Camera, CameraOff, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import Webcam from 'react-webcam';
import { BrowserMultiFormatReader } from '@zxing/library';
import { ChargerChangeModal } from './ChargerChangeModal';

interface ChargerSectionProps {
  orderId: string;
  engineerId: string;
}

interface ChargerUsage {
  id: string;
  serial_number: string;
  charger_name: string;
  used_at: string;
  charger_inventory_id?: string;
}

interface AssignedCharger {
  id: string;
  serial_number: string;
  status: string;
  notes: string | null;
  charger_item_id: string;
  assigned_order_id: string | null;
  inventory_items: {
    name: string;
    sku: string;
  };
}

export function ChargerSection({ orderId, engineerId }: ChargerSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const webcamRef = useRef<Webcam>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [selectedChargerId, setSelectedChargerId] = useState<string>("");
  const [selectedChargerTypeId, setSelectedChargerTypeId] = useState<string>("");
  const [serialNumber, setSerialNumber] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // Fetch chargers assigned to this engineer AND this specific order
  const { data: assignedChargers = [] } = useQuery({
    queryKey: ['assigned-chargers', engineerId, orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charger_inventory')
        .select(`
          id,
          serial_number,
          status,
          notes,
          charger_item_id,
          assigned_order_id,
          inventory_items:charger_item_id (
            name,
            sku
          )
        `)
        .or(`engineer_id.eq.${engineerId},assigned_order_id.eq.${orderId}`)
        .in('status', ['assigned', 'dispatched'])
        .order('serial_number');
      
      if (error) {
        console.error('Error fetching chargers:', error);
        throw error;
      }
      
      console.log('Fetched chargers:', data);
      return data as AssignedCharger[];
    }
  });

  // Fetch existing charger usage records for this order
  const { data: existingUsage = [] } = useQuery({
    queryKey: ['charger-usage', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineer_materials_used')
        .select(`
          id,
          serial_number,
          item_name,
          used_at,
          charger_inventory_id,
          notes
        `)
        .eq('order_id', orderId)
        .not('serial_number', 'is', null)
        .order('used_at', { ascending: false });
      
      if (error) throw error;
      return data.map(item => ({
        id: item.id,
        serial_number: item.serial_number || '',
        charger_name: item.item_name,
        used_at: item.used_at,
        charger_inventory_id: item.charger_inventory_id || undefined
      }));
    }
  });

  // Fetch available charger types
  const { data: chargerTypes = [] } = useQuery({
    queryKey: ['charger-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku')
        .eq('is_charger', true)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Get assigned charger for this specific order (if any)
  const orderAssignedCharger = assignedChargers.find(c => c.assigned_order_id === orderId);
  
  console.log('All assigned chargers:', assignedChargers);
  console.log('Order assigned charger:', orderAssignedCharger);
  console.log('Order ID:', orderId);
  console.log('Engineer ID:', engineerId);

  // Set initial selection to default charger type (Ohme ePod) if available
  useEffect(() => {
    if (chargerTypes.length > 0 && !selectedChargerTypeId) {
      const defaultCharger = chargerTypes.find(ct => ct.name.toLowerCase().includes('epod')) || chargerTypes[0];
      if (defaultCharger) {
        setSelectedChargerTypeId(defaultCharger.id);
      }
    }
  }, [chargerTypes, selectedChargerTypeId]);

  // Auto-select charger type when serial number is entered/scanned
  useEffect(() => {
    if (!serialNumber.trim()) return;
    
    const lookupChargerType = async () => {
      try {
        const { data, error } = await supabase
          .from('charger_inventory')
          .select(`
            charger_item_id,
            inventory_items:charger_item_id (
              id,
              name,
              sku
            )
          `)
          .eq('serial_number', serialNumber.trim())
          .single();

        if (!error && data?.charger_item_id) {
          console.log('Found charger in inventory:', data);
          setSelectedChargerTypeId(data.charger_item_id);
          toast({
            title: "Charger type detected",
            description: `Auto-selected: ${data.inventory_items?.name}`,
          });
        } else {
          console.log('Charger not found in inventory, keeping current selection');
        }
      } catch (error) {
        console.log('Error looking up charger type:', error);
        // Don't show error to user - just keep current selection
      }
    };

    // Debounce the lookup to avoid too many API calls
    const timeoutId = setTimeout(lookupChargerType, 500);
    return () => clearTimeout(timeoutId);
  }, [serialNumber, toast]);

  // Mutation to save charger usage
  const saveChargerUsage = useMutation({
    mutationFn: async ({ 
      chargerInventoryId, 
      serialNumber, 
      chargerName,
      chargerItemId
    }: { 
      chargerInventoryId?: string; 
      serialNumber: string; 
      chargerName: string;
      chargerItemId?: string;
    }) => {
      let finalChargerInventoryId = chargerInventoryId;

      // If no chargerInventoryId provided, check if charger exists in inventory by serial number
      if (!chargerInventoryId) {
        const { data: existingCharger } = await supabase
          .from('charger_inventory')
          .select('id, charger_item_id')
          .eq('serial_number', serialNumber)
          .single();

        if (existingCharger) {
          finalChargerInventoryId = existingCharger.id;
        } else if (chargerItemId) {
          // Create new charger in inventory with selected charger type
          const { data: newCharger, error: createError } = await supabase
            .from('charger_inventory')
            .insert({
              charger_item_id: chargerItemId,
              serial_number: serialNumber,
              status: 'deployed',
              engineer_id: engineerId,
              notes: `Auto-created from job scan. Used on order: ${orderId}`
            })
            .select('id')
            .single();

          if (createError) {
            console.error('Failed to create charger in inventory:', createError);
            // Continue without charger_inventory_id - just record the usage
          } else {
            finalChargerInventoryId = newCharger.id;
          }
        }
      }

      const { data, error } = await supabase
        .from('engineer_materials_used')
        .insert({
          order_id: orderId,
          engineer_id: engineerId,
          item_name: chargerName,
          serial_number: serialNumber,
          charger_inventory_id: finalChargerInventoryId,
          quantity: 1,
          notes: 'EV Charger Installation'
        })
        .select()
        .single();

      if (error) throw error;

      // Update charger status to 'deployed' if we have charger inventory ID
      if (finalChargerInventoryId) {
        await supabase
          .from('charger_inventory')
          .update({ 
            status: 'deployed',
            notes: `Used on order: ${orderId}`,
            assigned_order_id: orderId
          })
          .eq('id', finalChargerInventoryId);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['charger-usage', orderId] });
      queryClient.invalidateQueries({ queryKey: ['assigned-chargers', engineerId, orderId] });
    }
  });

  // Mutation to log charger changes
  const logChargerChange = useMutation({
    mutationFn: async ({ 
      originalChargerSerial, 
      newChargerSerial, 
      reason, 
      description 
    }: {
      originalChargerSerial: string;
      newChargerSerial: string; 
      reason: string;
      description?: string;
    }) => {
      const originalCharger = assignedChargers.find(c => c.serial_number === originalChargerSerial);
      const newCharger = assignedChargers.find(c => c.serial_number === newChargerSerial);

      const { error } = await supabase
        .from('charger_change_log')
        .insert({
          order_id: orderId,
          engineer_id: engineerId,
          original_charger_id: originalCharger?.id,
          new_charger_id: newCharger?.id,
          original_serial_number: originalChargerSerial,
          new_serial_number: newChargerSerial,
          reason_category: reason,
          reason_description: description,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;
    }
  });

  const startScanning = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(true);
      toast({
        title: "Camera not supported",
        description: "Your device doesn't support camera access.",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setCameraError(false);
    
    try {
      // Request camera permissions first
      await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });

      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      
      // Start continuous scanning with proper error handling
      setTimeout(() => {
        if (webcamRef.current?.video) {
          codeReader.decodeFromVideoDevice(
            undefined, 
            webcamRef.current.video, 
            (result, error) => {
              if (result) {
                const scannedText = result.getText();
                setSerialNumber(scannedText);
                stopScanning();
                toast({
                  title: "Barcode scanned",
                  description: `Serial number: ${scannedText}`,
                });
              }
              if (error && error.name !== 'NotFoundException' && error.name !== 'NotFoundException2') {
                console.error('Barcode scanning error:', error);
              }
            }
          );
        }
      }, 1000); // Give webcam time to initialize
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraError(true);
      setIsScanning(false);
      toast({
        title: "Camera access denied",
        description: "Please allow camera access to scan barcodes.",
        variant: "destructive",
      });
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    setIsScanning(false);
  };

  const handleAddCharger = async () => {
    if (!serialNumber.trim()) {
      toast({
        title: "Serial number required",
        description: "Please enter or scan a charger serial number.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedChargerTypeId) {
      toast({
        title: "Charger type required",
        description: "Please select a charger type.",
        variant: "destructive",
      });
      return;
    }

    // Check if this serial number is already used on this order
    if (existingUsage.some(usage => usage.serial_number === serialNumber)) {
      toast({
        title: "Charger already recorded",
        description: "This charger has already been recorded for this job.",
        variant: "destructive",
      });
      return;
    }

    // Get selected charger type details
    const selectedChargerType = chargerTypes.find(ct => ct.id === selectedChargerTypeId);
    const chargerTypeName = selectedChargerType?.name || "EV Charger";

    try {
      await saveChargerUsage.mutateAsync({
        serialNumber: serialNumber,
        chargerName: chargerTypeName,
        chargerItemId: selectedChargerTypeId
      });

      toast({
        title: "Charger recorded",
        description: `${chargerTypeName} (${serialNumber}) saved to job materials.`,
      });

      // Reset form
      setSelectedChargerTypeId("");
      setSerialNumber("");
    } catch (error) {
      console.error('Error saving charger usage:', error);
      toast({
        title: "Save failed",
        description: "Failed to save charger usage. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveCharger = async (id: string) => {
    try {
      const { error } = await supabase
        .from('engineer_materials_used')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Refresh the usage data
      queryClient.invalidateQueries({ queryKey: ['charger-usage', orderId] });
      
      toast({
        title: "Charger removed",
        description: "Charger usage has been removed from this job.",
      });
    } catch (error) {
      console.error('Error removing charger:', error);
      toast({
        title: "Remove failed",
        description: "Failed to remove charger usage. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Charger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Show order-assigned charger if exists */}
        {orderAssignedCharger && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-primary">Assigned Charger for this Job</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {orderAssignedCharger.inventory_items?.name} - {orderAssignedCharger.serial_number}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Status: {orderAssignedCharger.status}
              </span>
            </div>
            {orderAssignedCharger.notes && (
              <p className="text-xs text-muted-foreground mt-1">{orderAssignedCharger.notes}</p>
            )}
          </div>
        )}

        {/* Add Charger Form */}
        <div className="border rounded-lg p-4 space-y-4 bg-background/50">
          <h4 className="font-medium text-sm">Record Charger Usage</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="charger-type-select">Charger Type (Auto-detected from Serial)</Label>
              <Select value={selectedChargerTypeId} onValueChange={setSelectedChargerTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose charger type..." />
                </SelectTrigger>
                <SelectContent>
                  {chargerTypes.length > 0 ? (
                    chargerTypes.map((chargerType) => (
                      <SelectItem key={chargerType.id} value={chargerType.id}>
                        {chargerType.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No charger types available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial-input">Or Scan/Enter Serial Number</Label>
              <div className="flex gap-2">
                <Input
                  id="serial-input"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Enter or scan charger serial"
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={isScanning ? stopScanning : startScanning}
                  disabled={cameraError}
                >
                  {isScanning ? <CameraOff className="h-4 w-4" /> : <Scan className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Camera for barcode scanning */}
          {isScanning && (
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Point camera at barcode</Label>
                <Button variant="ghost" size="sm" onClick={stopScanning}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  className="w-full max-w-md mx-auto rounded-lg"
                  videoConstraints={{
                    width: 640,
                    height: 480,
                    facingMode: "environment"
                  }}
                  onUserMediaError={() => setCameraError(true)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button 
              onClick={handleAddCharger} 
              disabled={!serialNumber.trim() || !selectedChargerTypeId || saveChargerUsage.isPending}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {saveChargerUsage.isPending ? "Recording..." : "Record Charger"}
            </Button>
          </div>
        </div>

        {/* Chargers Used List */}
        {existingUsage.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Chargers Used ({existingUsage.length})</h4>
            <div className="space-y-2">
              {existingUsage.map((charger) => (
                <div key={charger.id} className="flex items-center justify-between p-3 border rounded-lg bg-background/30">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{charger.charger_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {charger.serial_number}
                      </Badge>
                      {charger.charger_inventory_id && (
                        <Badge variant="outline" className="text-xs">
                          Tracked
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Recorded: {new Date(charger.used_at).toLocaleString()}
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleRemoveCharger(charger.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Message */}
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
          <div className="text-sm">
            <p className="text-primary font-medium mb-1">Charger Tracking</p>
            <p className="text-muted-foreground">
              Select the charger type and scan or enter the serial number to record which charger was installed on this job.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}