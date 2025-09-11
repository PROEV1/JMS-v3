import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  const [serialNumber, setSerialNumber] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeModalData, setChangeModalData] = useState<{original: string, new: string}>({original: "", new: ""});

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

  // Get assigned charger for this specific order (if any)
  const orderAssignedCharger = assignedChargers.find(c => c.assigned_order_id === orderId);
  
  console.log('All assigned chargers:', assignedChargers);
  console.log('Order assigned charger:', orderAssignedCharger);
  console.log('Order ID:', orderId);
  console.log('Engineer ID:', engineerId);

  // Set initial selection to order-assigned charger
  useEffect(() => {
    if (orderAssignedCharger && !selectedChargerId) {
      setSelectedChargerId(orderAssignedCharger.id);
      setSerialNumber(orderAssignedCharger.serial_number || "");
    }
  }, [orderAssignedCharger, selectedChargerId]);

  // Mutation to save charger usage
  const saveChargerUsage = useMutation({
    mutationFn: async ({ chargerInventoryId, serialNumber, chargerName }: { 
      chargerInventoryId?: string; 
      serialNumber: string; 
      chargerName: string; 
    }) => {
      const { data, error } = await supabase
        .from('engineer_materials_used')
        .insert({
          order_id: orderId,
          engineer_id: engineerId,
          item_name: chargerName,
          serial_number: serialNumber,
          charger_inventory_id: chargerInventoryId,
          quantity: 1,
          notes: 'EV Charger Installation'
        })
        .select()
        .single();

      if (error) throw error;

      // Update charger status to 'deployed' if we have charger inventory ID
      if (chargerInventoryId) {
        await supabase
          .from('charger_inventory')
          .update({ 
            status: 'deployed',
            notes: `Used on order: ${orderId}`
          })
          .eq('id', chargerInventoryId);
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

  const handleChargerSelect = (chargerId: string) => {
    const selectedCharger = assignedChargers.find(charger => charger.id === chargerId);
    
    // Check if this is a different charger than originally assigned to order
    if (orderAssignedCharger && selectedCharger && 
        orderAssignedCharger.id !== selectedCharger.id &&
        orderAssignedCharger.serial_number !== selectedCharger.serial_number) {
      
      setChangeModalData({
        original: `${orderAssignedCharger.inventory_items?.name} (${orderAssignedCharger.serial_number})`,
        new: `${selectedCharger.inventory_items?.name} (${selectedCharger.serial_number})`
      });
      setShowChangeModal(true);
      return;
    }
    
    setSelectedChargerId(chargerId);
    if (selectedCharger) {
      setSerialNumber(selectedCharger.serial_number || "");
    }
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

    // Check if this serial number is already used on this order
    if (existingUsage.some(usage => usage.serial_number === serialNumber)) {
      toast({
        title: "Charger already recorded",
        description: "This charger has already been recorded for this job.",
        variant: "destructive",
      });
      return;
    }

    // Find the charger details
    const charger = assignedChargers.find(c => c.serial_number === serialNumber) || 
                   assignedChargers.find(c => c.id === selectedChargerId);
    
    const chargerName = charger?.inventory_items?.name || "EV Charger";

    try {
      await saveChargerUsage.mutateAsync({
        chargerInventoryId: charger?.id,
        serialNumber: serialNumber,
        chargerName: chargerName
      });

      toast({
        title: "Charger recorded",
        description: `${chargerName} (${serialNumber}) saved to job materials.`,
      });

      // Reset form
      setSelectedChargerId("");
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

  const handleChargerChange = async (reason: string, description?: string) => {
    const selectedCharger = assignedChargers.find(c => c.id === selectedChargerId) ||
                           assignedChargers.find(c => c.serial_number === serialNumber);
    
    if (!orderAssignedCharger || !selectedCharger) return;

    try {
      // Log the charger change
      await logChargerChange.mutateAsync({
        originalChargerSerial: orderAssignedCharger.serial_number,
        newChargerSerial: selectedCharger.serial_number || serialNumber,
        reason,
        description
      });

      // Update the selection
      setSelectedChargerId(selectedCharger.id);
      setSerialNumber(selectedCharger.serial_number || serialNumber);
      setShowChangeModal(false);

      toast({
        title: "Charger change logged",
        description: "The charger change has been recorded with the reason provided.",
      });
    } catch (error) {
      console.error('Error logging charger change:', error);
      toast({
        title: "Change log failed",
        description: "Failed to log charger change. Please try again.",
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
              <Label htmlFor="charger-select">Available Chargers</Label>
              <Select value={selectedChargerId} onValueChange={handleChargerSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose charger..." />
                </SelectTrigger>
                <SelectContent>
                  {assignedChargers.length > 0 ? (
                    <>
                      {/* Order-assigned chargers first */}
                      {assignedChargers.filter(c => c.assigned_order_id === orderId).length > 0 && (
                        <SelectGroup>
                          <SelectLabel>🎯 Assigned to this Job</SelectLabel>
                          {assignedChargers
                            .filter(c => c.assigned_order_id === orderId)
                            .map((charger) => (
                              <SelectItem key={charger.id} value={charger.id}>
                                {charger.inventory_items?.name || "EV Charger"} - {charger.serial_number}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      )}
                      
                      {/* Engineer-assigned chargers */}
                      {assignedChargers.filter(c => c.assigned_order_id !== orderId).length > 0 && (
                        <SelectGroup>
                          <SelectLabel>🔧 Your Available Chargers</SelectLabel>
                          {assignedChargers
                            .filter(c => c.assigned_order_id !== orderId)
                            .map((charger) => (
                              <SelectItem key={charger.id} value={charger.id}>
                                {charger.inventory_items?.name || "EV Charger"} - {charger.serial_number}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      )}
                    </>
                  ) : (
                    <SelectItem value="none" disabled>
                      No chargers available
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
              disabled={!serialNumber.trim() || saveChargerUsage.isPending}
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
              Record which charger was installed on this job. Chargers assigned to this specific job are shown first. 
              If you need to use a different charger, you'll be asked to provide a reason for the change.
            </p>
          </div>
        </div>

        {/* Charger Change Modal */}
        <ChargerChangeModal
          isOpen={showChangeModal}
          onClose={() => setShowChangeModal(false)}
          onConfirm={handleChargerChange}
          originalCharger={changeModalData.original}
          newCharger={changeModalData.new}
        />
      </CardContent>
    </Card>
  );
}