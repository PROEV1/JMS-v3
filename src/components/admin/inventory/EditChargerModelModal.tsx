import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
}

interface ChargerModel {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  default_cost: number;
  reorder_point: number;
  supplier_name: string | null;
  is_active: boolean;
  units_count: number;
  available_units: number;
  assigned_units: number;
  created_at: string;
}

interface EditChargerModelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: ChargerModel;
}

export function EditChargerModelModal({ open, onOpenChange, model }: EditChargerModelModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    default_cost: 0,
    reorder_point: 1,
    supplier_id: 'none',
    is_active: true,
  });

  // Populate form when model changes
  React.useEffect(() => {
    if (model && open) {
      // Parse description to extract model details
      const description = model.description || '';
      const parts = description.split(' | ');
      
      setFormData({
        name: model.name,
        description: parts[0] || '',
        default_cost: model.default_cost,
        reorder_point: model.reorder_point,
        supplier_id: 'none', // Will be populated from query
        is_active: model.is_active,
      });
    }
  }, [model, open]);

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['inventory-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_suppliers' as any)
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return (data as unknown) as Supplier[];
    }
  });

  // Get current supplier ID
  React.useEffect(() => {
    const fetchModelSupplier = async () => {
      if (model && suppliers.length > 0) {
        const { data } = await supabase
          .from('inventory_items')
          .select('supplier_id')
          .eq('id', model.id)
          .single();

        if (data && data.supplier_id) {
          setFormData(prev => ({ ...prev, supplier_id: data.supplier_id }));
        }
      }
    };

    fetchModelSupplier();
  }, [model, suppliers]);

  const updateChargerModelMutation = useMutation({
    mutationFn: async (modelData: typeof formData) => {
      const supplierIdValue = modelData.supplier_id === 'none' || !modelData.supplier_id ? null : modelData.supplier_id;
      
      const payload = {
        name: modelData.name.trim(),
        description: modelData.description?.trim() || null,
        default_cost: Number(modelData.default_cost) || 0,
        reorder_point: Number(modelData.reorder_point) || 1,
        supplier_id: supplierIdValue,
        is_active: modelData.is_active
      };

      const { data: updatedModel, error } = await supabase
        .from('inventory_items')
        .update(payload)
        .eq('id', model.id)
        .select()
        .single();

      if (error) throw error;

      return updatedModel;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Charger model updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["charger-models"] });
      queryClient.invalidateQueries({ queryKey: ["charger-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error updating charger model:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update charger model",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Model name is required",
      });
      return;
    }

    updateChargerModelMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Edit Charger Model
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Model Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Tesla Wall Connector Gen 3"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Model description and features"
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default_cost">Unit Cost (£)</Label>
              <Input
                id="default_cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.default_cost}
                onChange={(e) => setFormData(prev => ({ ...prev, default_cost: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reorder_point">Reorder Point</Label>
              <Input
                id="reorder_point"
                type="number"
                min="0"
                value={formData.reorder_point}
                onChange={(e) => setFormData(prev => ({ ...prev, reorder_point: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier_id">Supplier</Label>
            <Select 
              value={formData.supplier_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No supplier</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active">Active Model</Label>
          </div>

          <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
            <strong>SKU:</strong> {model.sku}<br />
            <strong>Total Units:</strong> {model.units_count}<br />
            <strong>Available:</strong> {model.available_units} | <strong>Assigned:</strong> {model.assigned_units}
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
              disabled={updateChargerModelMutation.isPending}
            >
              {updateChargerModelMutation.isPending ? "Updating..." : "Update Model"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}