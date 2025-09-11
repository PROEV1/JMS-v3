import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Zap, Plus, X, Scan, Camera, CameraOff } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import Webcam from 'react-webcam';
import { BrowserMultiFormatReader } from '@zxing/library';

interface ChargerSectionProps {
  orderId: string;
  engineerId: string;
}

interface ChargerUsage {
  id: string;
  serial_number: string;
  charger_name: string;
  used_at: string;
}

export function ChargerSection({ orderId, engineerId }: ChargerSectionProps) {
  const { toast } = useToast();
  const webcamRef = useRef<Webcam>(null);
  const [selectedChargerId, setSelectedChargerId] = useState<string>("");
  const [serialNumber, setSerialNumber] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [chargersUsed, setChargersUsed] = useState<ChargerUsage[]>([]);

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
        .in('status', ['assigned', 'dispatched'])
        .order('serial_number');
      
      if (error) throw error;
      return data;
    }
  });

  const startScanning = async () => {
    setIsScanning(true);
    setCameraError(false);
    
    try {
      const codeReader = new BrowserMultiFormatReader();
      
      // Start continuous scanning
      codeReader.decodeFromVideoDevice(
        undefined, 
        webcamRef.current?.video || undefined, 
        (result, error) => {
          if (result) {
            setSerialNumber(result.getText());
            setIsScanning(false);
            codeReader.reset();
            toast({
              title: "Barcode scanned",
              description: `Serial number: ${result.getText()}`,
            });
          }
          if (error && error.name !== 'NotFoundException') {
            console.error('Barcode scanning error:', error);
            setCameraError(true);
            setIsScanning(false);
            codeReader.reset();
            toast({
              title: "Scanning failed",
              description: "Unable to scan barcode. Please enter manually.",
              variant: "destructive",
            });
          }
        }
      );
    } catch (error) {
      console.error('Barcode scanning error:', error);
      setCameraError(true);
      setIsScanning(false);
      toast({
        title: "Scanning failed",
        description: "Unable to scan barcode. Please enter manually.",
        variant: "destructive",
      });
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  const handleChargerSelect = (chargerId: string) => {
    setSelectedChargerId(chargerId);
    const selectedCharger = assignedChargers.find(charger => charger.id === chargerId);
    if (selectedCharger) {
      setSerialNumber(selectedCharger.serial_number || "");
    }
  };

  const handleAddCharger = () => {
    if (!serialNumber.trim()) {
      toast({
        title: "Serial number required",
        description: "Please enter or scan a charger serial number.",
        variant: "destructive",
      });
      return;
    }

    // Find the charger details
    const charger = assignedChargers.find(c => c.serial_number === serialNumber) || 
                   assignedChargers.find(c => c.id === selectedChargerId);
    
    const chargerName = charger?.inventory_items?.name || "EV Charger";

    // Add to used chargers list (in a real implementation, this would be saved to database)
    const newChargerUsage: ChargerUsage = {
      id: Date.now().toString(),
      serial_number: serialNumber,
      charger_name: chargerName,
      used_at: new Date().toISOString(),
    };

    setChargersUsed(prev => [...prev, newChargerUsage]);
    
    toast({
      title: "Charger recorded",
      description: `${chargerName} (${serialNumber}) added to job materials.`,
    });

    // Reset form
    setSelectedChargerId("");
    setSerialNumber("");
  };

  const handleRemoveCharger = (id: string) => {
    setChargersUsed(prev => prev.filter(charger => charger.id !== id));
    toast({
      title: "Charger removed",
      description: "Charger usage has been removed from this job.",
    });
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
        {/* Add Charger Form */}
        <div className="border rounded-lg p-4 space-y-4 bg-background/50">
          <h4 className="font-medium text-sm">Record Charger Usage</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              disabled={!serialNumber.trim()}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Record Charger
            </Button>
          </div>
        </div>

        {/* Chargers Used List */}
        {chargersUsed.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Chargers Used ({chargersUsed.length})</h4>
            <div className="space-y-2">
              {chargersUsed.map((charger) => (
                <div key={charger.id} className="flex items-center justify-between p-3 border rounded-lg bg-background/30">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{charger.charger_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {charger.serial_number}
                      </Badge>
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
              Record which charger was installed on this job. You can select from your assigned chargers or scan the barcode on the charger unit.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}