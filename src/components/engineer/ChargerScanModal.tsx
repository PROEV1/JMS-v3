import React, { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Scan, Camera, X, CheckCircle, AlertCircle } from 'lucide-react';
import Webcam from 'react-webcam';
import { BrowserMultiFormatReader } from '@zxing/library';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChargerScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engineerId: string;
  vanLocationId: string;
}

interface ChargerInventoryItem {
  id: string;
  serial_number: string;
  status: string;
  inventory_items: {
    name: string;
    sku: string;
  };
}

const CHARGER_STATUSES = [
  { value: 'delivered', label: 'Delivered', color: 'bg-green-500' },
  { value: 'dispatched', label: 'Dispatched', color: 'bg-blue-500' },
  { value: 'assigned', label: 'Assigned', color: 'bg-yellow-500' },
  { value: 'used', label: 'Used', color: 'bg-gray-500' },
];

export function ChargerScanModal({ open, onOpenChange, engineerId, vanLocationId }: ChargerScanModalProps) {
  const [serialNumber, setSerialNumber] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('delivered');
  const [isScanning, setIsScanning] = useState(false);
  const [foundCharger, setFoundCharger] = useState<ChargerInventoryItem | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const webcamRef = useRef<Webcam>(null);
  const codeReader = useRef<BrowserMultiFormatReader>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation to update charger status
  const updateChargerMutation = useMutation({
    mutationFn: async ({ chargerId, status }: { chargerId: string; status: string }) => {
      const { error } = await supabase
        .from('charger_inventory')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', chargerId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Charger status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['van-stock-items'] });
      handleClose();
    },
    onError: (error) => {
      console.error('Error updating charger:', error);
      toast({
        title: "Error",
        description: "Failed to update charger status",
        variant: "destructive",
      });
    },
  });

  // Search for charger by serial number
  const searchCharger = useCallback(async (serial: string) => {
    if (!serial.trim()) {
      setFoundCharger(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('charger_inventory')
        .select(`
          id,
          serial_number,
          status,
          inventory_items!charger_item_id(name, sku)
        `)
        .eq('serial_number', serial.trim())
        .eq('engineer_id', engineerId)
        .maybeSingle();

      if (error) throw error;
      setFoundCharger(data);
    } catch (error) {
      console.error('Error searching for charger:', error);
      setFoundCharger(null);
    }
  }, [engineerId]);

  const startScanning = useCallback(async () => {
    try {
      setIsScanning(true);
      setCameraError(null);
      
      if (!codeReader.current) {
        codeReader.current = new BrowserMultiFormatReader();
      }

      const videoElement = webcamRef.current?.video;
      if (!videoElement) return;

      await codeReader.current.decodeFromVideoDevice(undefined, videoElement, (result, error) => {
        if (result) {
          const scannedText = result.getText();
          setSerialNumber(scannedText);
          searchCharger(scannedText);
          stopScanning();
          toast({
            title: "Barcode Scanned",
            description: `Serial number: ${scannedText}`,
          });
        }
        if (error && error.name !== 'NotFoundException') {
          console.error('Barcode scanning error:', error);
        }
      });
    } catch (error) {
      console.error('Error starting scanner:', error);
      setCameraError('Failed to access camera. Please check permissions.');
      setIsScanning(false);
    }
  }, [searchCharger, toast]);

  const stopScanning = useCallback(() => {
    if (codeReader.current) {
      codeReader.current.reset();
    }
    setIsScanning(false);
  }, []);

  const handleSerialNumberChange = (value: string) => {
    setSerialNumber(value);
    searchCharger(value);
  };

  const handleUpdateStatus = () => {
    if (foundCharger && selectedStatus) {
      updateChargerMutation.mutate({ 
        chargerId: foundCharger.id, 
        status: selectedStatus 
      });
    }
  };

  const handleClose = () => {
    stopScanning();
    setSerialNumber('');
    setFoundCharger(null);
    setSelectedStatus('delivered');
    setCameraError(null);
    onOpenChange(false);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = CHARGER_STATUSES.find(s => s.value === status);
    return statusConfig ? (
      <Badge 
        variant="secondary" 
        className={`text-white ${statusConfig.color}`}
      >
        {statusConfig.label}
      </Badge>
    ) : (
      <Badge variant="outline">{status}</Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Charger</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Serial Number Input */}
          <div className="space-y-2">
            <Label>Serial Number</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter or scan serial number"
                value={serialNumber}
                onChange={(e) => handleSerialNumberChange(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={isScanning ? stopScanning : startScanning}
                disabled={cameraError !== null}
              >
                {isScanning ? <X className="h-4 w-4" /> : <Scan className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Camera Section */}
          {isScanning && (
            <div className="space-y-2">
              <Label>Camera</Label>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                {cameraError ? (
                  <div className="absolute inset-0 flex items-center justify-center text-white p-4 text-center">
                    <div>
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">{cameraError}</p>
                    </div>
                  </div>
                ) : (
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    className="w-full h-full object-cover"
                    onUserMediaError={(error) => {
                      console.error('Camera error:', error);
                      setCameraError('Camera not available');
                      setIsScanning(false);
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Charger Details */}
          {foundCharger ? (
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium">{foundCharger.inventory_items?.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    SKU: {foundCharger.inventory_items?.sku}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Serial: {foundCharger.serial_number}
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium">Current Status:</span>
                {getStatusBadge(foundCharger.status)}
              </div>

              {/* Status Update */}
              <div className="space-y-2">
                <Label>Update Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARGER_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${status.color}`} />
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : serialNumber ? (
            <div className="p-4 border rounded-lg bg-muted/30 text-center">
              <AlertCircle className="h-5 w-5 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm">Charger not found in your inventory</p>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateStatus}
              disabled={!foundCharger || !selectedStatus || updateChargerMutation.isPending}
              className="flex-1"
            >
              {updateChargerMutation.isPending ? 'Updating...' : 'Update Status'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}