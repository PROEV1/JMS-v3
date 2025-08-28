import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Supplier {
  id: string;
  name: string;
}

interface AddChargerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddChargerModal({ open, onOpenChange }: AddChargerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    model: '',
    power_rating: '',
    connector_type: '',
    default_cost: 0,
    reorder_point: 1,
    supplier_id: 'none',
    serial_number: '' // Single serial number field
  });

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        description: '',
        model: '',
        power_rating: '',
        connector_type: '',
        default_cost: 0,
        reorder_point: 1,
        supplier_id: 'none',
        serial_number: ''
      });
    }
  }, [open]);

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

  // Remove duplicate charger name validation - allowing duplicate names

  const createChargerMutation = useMutation({
    mutationFn: async (chargerData: typeof formData) => {
      const supplierIdValue = chargerData.supplier_id === 'none' || !chargerData.supplier_id ? null : chargerData.supplier_id;
      
      // Build description with charger-specific details
      const description = [
        chargerData.description?.trim(),
        chargerData.model ? `Model: ${chargerData.model}` : null,
        chargerData.power_rating ? `Power: ${chargerData.power_rating}` : null,
        chargerData.connector_type ? `Connector: ${chargerData.connector_type}` : null
      ].filter(Boolean).join(' | ');

      const payload = {
        name: chargerData.name.trim(),
        sku: `CHARGER-${Date.now()}`, // Auto-generate SKU since it's required in DB
        description: description || null,
        unit: 'each',
        default_cost: Number(chargerData.default_cost) || 0,
        min_level: 0,
        max_level: 0,
        reorder_point: Number(chargerData.reorder_point) || 1,
        is_serialized: true, // Chargers are always serialized
        is_charger: true, // Obviously true for chargers
        is_active: true,
        supplier_id: supplierIdValue
      };

      // First, create the charger model in inventory_items
      const { data: chargerItem, error: itemError } = await supabase
        .from('inventory_items')
        .insert([payload])
        .select()
        .single();

      if (itemError) throw itemError;

      // Then create individual charger unit with serial number in charger_inventory table
      if (chargerData.serial_number.trim()) {
        const chargerUnit = {
          charger_item_id: chargerItem.id,
          serial_number: chargerData.serial_number.trim(),
          status: 'available'
        };

        const { error: inventoryError } = await supabase
          .from('charger_inventory')
          .insert([chargerUnit]);

        if (inventoryError) throw inventoryError;
      }

      return chargerItem;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Charger added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["charger-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error creating charger:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create charger",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Charger name is required",
      });
      return;
    }

    // Duplicate names are now allowed

    // Validate that serial number is provided
    if (!formData.serial_number.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Serial number is required",
      });
      return;
    }

    createChargerMutation.mutate(formData);
  };

  // Remove similar names check since duplicates are allowed

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Add New Charger
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Charger Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Tesla Wall Connector Gen 3"
              required
            />
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                placeholder="e.g., Generation 3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="power_rating">Power Rating</Label>
              <Input
                id="power_rating"
                value={formData.power_rating}
                onChange={(e) => setFormData(prev => ({ ...prev, power_rating: e.target.value }))}
                placeholder="e.g., 22kW, 7.4kW"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="connector_type">Connector Type</Label>
            <Select 
              value={formData.connector_type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, connector_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select connector type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Type 2">Type 2</SelectItem>
                <SelectItem value="Type 1">Type 1</SelectItem>
                <SelectItem value="CCS">CCS</SelectItem>
                <SelectItem value="CHAdeMO">CHAdeMO</SelectItem>
                <SelectItem value="Tesla">Tesla Proprietary</SelectItem>
                <SelectItem value="Universal">Universal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Additional Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Additional features, installation notes, etc."
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
              disabled={createChargerMutation.isPending}
            >
              {createChargerMutation.isPending ? "Adding..." : "Add Charger"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}