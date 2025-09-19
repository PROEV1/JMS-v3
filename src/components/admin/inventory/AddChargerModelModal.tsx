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
import { Settings, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chargerModelTemplates } from "@/utils/chargerModelTemplates";

interface Supplier {
  id: string;
  name: string;
}

interface AddChargerModelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddChargerModelModal({ open, onOpenChange }: AddChargerModelModalProps) {
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

  const createChargerModelMutation = useMutation({
    mutationFn: async (modelData: typeof formData) => {
      const supplierIdValue = modelData.supplier_id === 'none' || !modelData.supplier_id ? null : modelData.supplier_id;
      
      // Build description with charger-specific details
      const description = [
        modelData.description?.trim(),
        modelData.model ? `Model: ${modelData.model}` : null,
        modelData.power_rating ? `Power: ${modelData.power_rating}` : null,
        modelData.connector_type ? `Connector: ${modelData.connector_type}` : null
      ].filter(Boolean).join(' | ');

      const payload = {
        name: modelData.name.trim(),
        sku: `CHARGER-${Date.now()}`, // Auto-generate SKU since it's required in DB
        description: description || null,
        unit: 'each',
        default_cost: Number(modelData.default_cost) || 0,
        min_level: 0,
        max_level: 0,
        reorder_point: Number(modelData.reorder_point) || 1,
        is_serialized: true, // Chargers are always serialized
        is_charger: true, // Obviously true for chargers
        is_active: true,
        supplier_id: supplierIdValue
      };

      // Create the charger model in inventory_items (no individual units)
      const { data: chargerModel, error: modelError } = await supabase
        .from('inventory_items')
        .insert([payload])
        .select()
        .single();

      if (modelError) throw modelError;

      return chargerModel;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Charger model created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["charger-models"] });
      queryClient.invalidateQueries({ queryKey: ["charger-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error creating charger model:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create charger model",
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

    createChargerModelMutation.mutate(formData);
  };

  const applyTemplate = (templateKey: string) => {
    const template = chargerModelTemplates[templateKey];
    if (template) {
      setFormData(prev => ({
        ...prev,
        ...template
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Add New Charger Model
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Quick Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(chargerModelTemplates).map(([key, template]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(key)}
                    className="text-left justify-start"
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model">Model/Version</Label>
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
                disabled={createChargerModelMutation.isPending}
              >
                {createChargerModelMutation.isPending ? "Creating..." : "Create Model"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}