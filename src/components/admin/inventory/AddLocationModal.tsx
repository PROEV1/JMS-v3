
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AddLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddLocationModal({ open, onOpenChange }: AddLocationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState({
    name: '',
    code: '',
    type: 'warehouse',
    address: '',
    engineer_id: ''
  });

  // Fetch engineers for van assignment
  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers-for-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  const createLocationMutation = useMutation({
    mutationFn: async (locationData: typeof formData) => {
      const payload: any = {
        name: locationData.name,
        code: locationData.code || null,
        type: locationData.type,
        address: locationData.address || null,
        engineer_id: locationData.type === 'van' && locationData.engineer_id ? locationData.engineer_id : null
      };

      const { data, error } = await supabase
        .from('inventory_locations')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Location added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-locations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error('Error creating location:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create location",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'warehouse',
      address: '',
      engineer_id: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Location name is required",
      });
      return;
    }

    if (formData.type === 'van' && !formData.engineer_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Engineer is required for van locations",
      });
      return;
    }

    createLocationMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Location</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Location Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter location name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value, engineer_id: value !== 'van' ? '' : prev.engineer_id }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="van">Engineer Van</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.type === 'van' && (
            <div className="space-y-2">
              <Label htmlFor="engineer_id">Assign to Engineer *</Label>
              <Select 
                value={formData.engineer_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, engineer_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select engineer" />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map((engineer) => (
                    <SelectItem key={engineer.id} value={engineer.id}>
                      {engineer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="code">Location Code</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              placeholder="Optional code/identifier"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter address (optional)"
              className="min-h-[80px]"
            />
          </div>

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
              disabled={createLocationMutation.isPending}
            >
              {createLocationMutation.isPending ? "Adding..." : "Add Location"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
