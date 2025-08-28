import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Zap } from "lucide-react";

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

interface EditChargerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charger: ChargerUnit | null;
  chargerModel: string;
}

export function EditChargerModal({ open, onOpenChange, charger, chargerModel }: EditChargerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = React.useState({
    serial_number: '',
    status: ''
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open && charger) {
      setFormData({
        serial_number: charger.serial_number,
        status: charger.status
      });
    }
  }, [open, charger]);

  const deleteChargerMutation = useMutation({
    mutationFn: async () => {
      if (!charger) throw new Error('No charger selected');

      console.log('=== DELETE OPERATION START ===');
      console.log('Charger to delete:', {
        id: charger.id,
        serial_number: charger.serial_number,
        charger_item_id: charger.charger_item_id,
        isPlaceholder: charger.id.startsWith('placeholder-')
      });

      if (charger.id.startsWith('placeholder-')) {
        console.log('Deleting placeholder charger - no DB operation needed');
        return { success: true, type: 'placeholder' };
      } else {
        console.log('Deleting real charger from charger_inventory table');
        
        // First, check if the record exists
        const { data: existingRecord } = await supabase
          .from('charger_inventory')
          .select('*')
          .eq('id', charger.id)
          .single();
        
        console.log('Existing record check:', existingRecord);
        
        // Now delete it
        const { data, error } = await supabase
          .from('charger_inventory')
          .delete()
          .eq('id', charger.id)
          .select(); // This will return the deleted rows
        
        console.log('Delete result:', { data, error });
        
        if (error) {
          console.error('Delete error details:', error);
          throw error;
        }
        
        console.log('Delete successful, deleted rows:', data);
        return { success: true, type: 'database', deletedRows: data };
      }
    },
    onSuccess: (result) => {
      console.log('=== DELETE MUTATION SUCCESS ===');
      console.log('Delete result:', result);
      
      toast({
        title: "Success",
        description: `Charger ${charger?.serial_number} deleted successfully`,
      });
      
      console.log('Invalidating queries...');
      // Force refresh all related queries
      queryClient.invalidateQueries({ queryKey: ['charger-items'] });
      queryClient.invalidateQueries({ queryKey: ['charger-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      
      console.log('Closing modals...');
      onOpenChange(false);
      setShowDeleteConfirm(false);
      
      console.log('=== DELETE OPERATION COMPLETE ===');
    },
    onError: (error: any) => {
      console.error('=== DELETE MUTATION ERROR ===');
      console.error('Full error:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete charger",
      });
      setShowDeleteConfirm(false);
    },
  });

  const updateChargerMutation = useMutation({
    mutationFn: async (updateData: typeof formData) => {
      if (!charger) throw new Error('No charger selected');

      // Handle placeholder units by creating new inventory records
      if (charger.id.startsWith('placeholder-')) {
        const { data, error } = await supabase
          .from('charger_inventory')
          .insert({
            charger_item_id: charger.charger_item_id,
            serial_number: updateData.serial_number.trim(),
            status: updateData.status
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Update existing inventory record
        const { data, error } = await supabase
          .from('charger_inventory')
          .update({
            serial_number: updateData.serial_number.trim(),
            status: updateData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', charger.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Charger ${charger?.serial_number} updated successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["charger-items"] });
      queryClient.invalidateQueries({ queryKey: ["charger-metrics"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error updating charger:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update charger",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.serial_number.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Serial number is required",
      });
      return;
    }

    updateChargerMutation.mutate(formData);
  };

  if (!charger) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Edit Charger
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
            <p className="text-sm text-muted-foreground">Current SN: {charger.serial_number}</p>
            {charger.engineer_name && (
              <p className="text-sm">
                <span className="text-muted-foreground">Assigned to:</span> {charger.engineer_name}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serial_number">Serial Number *</Label>
              <Input
                id="serial_number"
                value={formData.serial_number}
                onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                placeholder="Enter serial number"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select 
                id="status"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="available">Available</option>
                <option value="assigned">Assigned</option>
                <option value="dispatched">Dispatched</option>
                <option value="delivered">Delivered</option>
                <option value="maintenance">Under Maintenance</option>
                <option value="decommissioned">Decommissioned</option>
              </select>
            </div>

            <div className="flex justify-between space-x-2 pt-4">
              <Button 
                type="button" 
                variant="destructive" 
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Charger
              </Button>
              <div className="flex space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateChargerMutation.isPending}
                >
                  {updateChargerMutation.isPending ? "Updating..." : "Update Charger"}
                </Button>
              </div>
            </div>
          </form>
        </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-background p-6 rounded-lg max-w-sm w-full mx-4 border">
                <h3 className="text-lg font-semibold mb-2">Delete Charger</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Are you sure you want to delete charger <strong>{charger?.serial_number}</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      console.log('Delete cancelled');
                      setShowDeleteConfirm(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      console.log('Delete confirmed, calling mutation');
                      deleteChargerMutation.mutate();
                    }}
                    disabled={deleteChargerMutation.isPending}
                  >
                    {deleteChargerMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}