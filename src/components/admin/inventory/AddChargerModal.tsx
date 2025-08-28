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
import { Zap } from "lucide-react";

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
    sku: '',
    description: '',
    model: '',
    power_rating: '',
    connector_type: '',
    default_cost: 0,
    reorder_point: 1,
    supplier_id: 'none',
    initial_serial_numbers: [''] // Add field for initial serial numbers
  });

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        sku: '',
        description: '',
        model: '',
        power_rating: '',
        connector_type: '',
        default_cost: 0,
        reorder_point: 1,
        supplier_id: 'none',
        initial_serial_numbers: ['']
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
        sku: chargerData.sku.trim(),
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

      // Then create individual charger units with serial numbers
      const validSerialNumbers = chargerData.initial_serial_numbers.filter(sn => sn.trim());
      if (validSerialNumbers.length > 0) {
        const chargerUnits = validSerialNumbers.map(serialNumber => ({
          charger_item_id: chargerItem.id,
          serial_number: serialNumber.trim(),
          status: 'available',
          order_id: null
        }));

        const { error: dispatchError } = await supabase
          .from('charger_dispatches')
          .insert(chargerUnits);

        if (dispatchError) throw dispatchError;
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
    
    if (!formData.name.trim() || !formData.sku.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Name and SKU are required",
      });
      return;
    }

    // Validate that at least one serial number is provided
    const validSerialNumbers = formData.initial_serial_numbers.filter(sn => sn.trim());
    if (validSerialNumbers.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "At least one serial number is required",
      });
      return;
    }

    createChargerMutation.mutate(formData);
  };

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
            <Label htmlFor="sku">SKU/Part Number *</Label>
            <Input
              id="sku"
              value={formData.sku}
              onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
              placeholder="e.g., TWC-GEN3-01"
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

          <div className="space-y-2">
            <Label>Initial Serial Numbers *</Label>
            <div className="space-y-2">
              {formData.initial_serial_numbers.map((serialNumber, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={serialNumber}
                    onChange={(e) => {
                      const newSerialNumbers = [...formData.initial_serial_numbers];
                      newSerialNumbers[index] = e.target.value;
                      setFormData(prev => ({ ...prev, initial_serial_numbers: newSerialNumbers }));
                    }}
                    placeholder={`Serial number ${index + 1}`}
                  />
                  {formData.initial_serial_numbers.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newSerialNumbers = formData.initial_serial_numbers.filter((_, i) => i !== index);
                        setFormData(prev => ({ ...prev, initial_serial_numbers: newSerialNumbers }));
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFormData(prev => ({ 
                    ...prev, 
                    initial_serial_numbers: [...prev.initial_serial_numbers, ''] 
                  }));
                }}
              >
                Add Another Serial Number
              </Button>
            </div>
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