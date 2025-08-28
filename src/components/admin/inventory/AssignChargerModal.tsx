import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Reset form when modal opens
  React.useEffect(() => {
    if (open && charger) {
      setSelectedEngineerId(charger.engineer_id || '');
      setSelectedLocationId(charger.location_id || '');
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
    mutationFn: async ({ engineerId, locationId }: { engineerId: string; locationId: string }) => {
      if (!charger) throw new Error('No charger selected');

      // For now, we'll simulate the assignment by updating a demo record
      // In a real system, you'd have a proper charger assignments table
      return {
        charger_id: charger.id,
        engineer_id: engineerId,
        location_id: locationId,
        assigned_at: new Date().toISOString()
      };
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
    assignChargerMutation.mutate({
      engineerId: selectedEngineerId,
      locationId: selectedLocationId
    });
  };

  if (!charger) return null;

  const selectedEngineer = engineers.find(e => e.id === selectedEngineerId);
  const selectedLocation = locations.find(l => l.id === selectedLocationId);

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
                      <div className="flex items-center gap-2">
                        <span>{engineer.name}</span>
                        <span className="text-xs text-muted-foreground">({engineer.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Selection */}
            <div className="space-y-2">
              <Label htmlFor="location">
                <MapPin className="w-4 h-4 inline mr-2" />
                Location
              </Label>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific location</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      <div className="flex items-center gap-2">
                        <span>{location.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {location.type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignment Preview */}
            {(selectedEngineer || selectedLocation) && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1">
                <p className="text-sm font-medium">Assignment Preview:</p>
                {selectedEngineer && (
                  <p className="text-sm">
                    <User className="w-3 h-3 inline mr-1" />
                    Engineer: {selectedEngineer.name}
                  </p>
                )}
                {selectedLocation && (
                  <p className="text-sm">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    Location: {selectedLocation.name} ({selectedLocation.type})
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