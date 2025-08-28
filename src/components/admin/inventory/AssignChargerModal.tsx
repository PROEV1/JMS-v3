import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, MapPin, Zap } from "lucide-react";

interface Engineer {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface Location {
  id: string;
  name: string;
  type: string;
  engineer_id?: string;
  is_active: boolean;
}

interface ChargerUnit {
  id: string;
  charger_item_id: string;
  serial_number: string;
  status: string;
  engineer_id: string | null;
  engineer_name: string | null;
  location_id: string | null;
  location_name: string | null;
}

interface AssignChargerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charger: ChargerUnit | null;
  chargerModel: string;
}

export function AssignChargerModal({ open, onOpenChange, charger, chargerModel }: AssignChargerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>('');
  const [locationAddress, setLocationAddress] = useState<string>('');

  // Reset form when modal opens
  React.useEffect(() => {
    if (open && charger) {
      setSelectedEngineerId(charger.engineer_id || '');
      setLocationAddress(charger.location_name || '');
    }
  }, [open, charger]);

  // Fetch engineers
  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name, email, is_active')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Engineer[];
    }
  });

  // Fetch inventory locations
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name, type, engineer_id, is_active')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Location[];
    }
  });

  const assignChargerMutation = useMutation({
    mutationFn: async ({ engineerId, address }: { engineerId: string; address: string }) => {
      if (!charger) throw new Error('No charger selected');

      // Handle special values
      const finalEngineerId = engineerId === 'unassigned' ? null : engineerId;
      
      // Find or create engineer van location
      let finalLocationId = null;
      if (finalEngineerId && finalEngineerId !== 'unassigned') {
        // Get engineer's van location or create one
        const { data: existingLocation } = await supabase
          .from('inventory_locations')
          .select('id')
          .eq('engineer_id', finalEngineerId)
          .eq('type', 'van')
          .single();

        if (existingLocation) {
          finalLocationId = existingLocation.id;
        } else {
          // Create van location for engineer
          const engineer = engineers.find(e => e.id === finalEngineerId);
          const { data: newLocation, error: locationError } = await supabase
            .from('inventory_locations')
            .insert({
              name: `Van Stock - ${engineer?.name}`,
              type: 'van',
              engineer_id: finalEngineerId,
              address: address || null
            })
            .select()
            .single();

          if (locationError) throw locationError;
          finalLocationId = newLocation.id;
        }
        
        // Update existing location address if provided
        if (address && finalLocationId) {
          await supabase
            .from('inventory_locations')
            .update({ address })
            .eq('id', finalLocationId);
        }
      }
      
      // Determine status based on assignment
      let status = 'available';
      if (finalEngineerId) {
        status = 'dispatched'; // Assigned to engineer
      }

      // Update the charger_inventory record with the engineer and location assignment
      const { data, error } = await supabase
        .from('charger_inventory')
        .update({
          engineer_id: finalEngineerId,
          location_id: finalLocationId,
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', charger.id)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw new Error(error.message || 'Failed to assign charger');
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Charger ${charger?.serial_number} assigned successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["charger-items"] });
      queryClient.invalidateQueries({ queryKey: ["charger-metrics"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error assigning charger:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign charger",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEngineerId || selectedEngineerId === '') {
      toast({
        variant: "destructive",
        title: "Error", 
        description: "Please select an engineer",
      });
      return;
    }
    
    assignChargerMutation.mutate({
      engineerId: selectedEngineerId,
      address: locationAddress
    });
  };

  if (!charger) return null;

  const selectedEngineer = engineers.find(e => e.id === selectedEngineerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Assign Charger
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Charger Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{chargerModel}</h4>
              <Badge variant={charger.status === 'available' ? 'secondary' : 'default'}>
                {charger.status || 'Available'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">SN: {charger.serial_number}</p>
            {charger.engineer_name && (
              <p className="text-sm">
                <span className="text-muted-foreground">Currently assigned to:</span> {charger.engineer_name}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Engineer Selection */}
            <div className="space-y-2">
              <Label htmlFor="engineer">
                <User className="w-4 h-4 inline mr-2" />
                Assign to Engineer
              </Label>
              <Select value={selectedEngineerId} onValueChange={setSelectedEngineerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select engineer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {engineers.map((engineer) => (
                    <SelectItem key={engineer.id} value={engineer.id}>
                      Van Stock - {engineer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Address Input */}
            <div className="space-y-2">
              <Label htmlFor="location">
                <MapPin className="w-4 h-4 inline mr-2" />
                Location Address (Optional)
              </Label>
              <Input
                value={locationAddress}
                onChange={(e) => {
                  console.log('Location address changing to:', e.target.value);
                  setLocationAddress(e.target.value);
                }}
                placeholder="Enter location address..."
                className="w-full"
              />
            </div>

            {/* Assignment Preview */}
            {(selectedEngineer || locationAddress) && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1">
                <p className="text-sm font-medium">Assignment Preview:</p>
                {selectedEngineer && (
                  <p className="text-sm">
                    <User className="w-3 h-3 inline mr-1" />
                    Engineer: {selectedEngineer.name}
                  </p>
                )}
                {locationAddress && (
                  <p className="text-sm">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    Location: Van Stock - {selectedEngineer?.name} ({locationAddress})
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={assignChargerMutation.isPending}
              >
                {assignChargerMutation.isPending ? "Assigning..." : "Assign Charger"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}