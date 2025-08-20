
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

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  default_cost: number;
  min_level: number;
  max_level: number;
  reorder_point: number;
  is_serialized: boolean;
  is_charger: boolean;
  is_active: boolean;
  supplier_id: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: InventoryItem | null;
}

export function AddItemModal({ open, onOpenChange, editItem }: AddItemModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!editItem;

  const [formData, setFormData] = React.useState({
    name: '',
    sku: '',
    description: '',
    unit: 'each',
    default_cost: 0,
    min_level: 0,
    max_level: 0,
    reorder_point: 0,
    is_serialized: false,
    is_charger: false,
    supplier_id: ''
  });

  // Reset form when modal opens/closes or editItem changes
  React.useEffect(() => {
    if (open) {
      if (editItem) {
        setFormData({
          name: editItem.name,
          sku: editItem.sku,
          description: editItem.description || '',
          unit: editItem.unit,
          default_cost: editItem.default_cost,
          min_level: editItem.min_level,
          max_level: editItem.max_level,
          reorder_point: editItem.reorder_point,
          is_serialized: editItem.is_serialized,
          is_charger: editItem.is_charger,
          supplier_id: editItem.supplier_id || ''
        });
      } else {
        setFormData({
          name: '',
          sku: '',
          description: '',
          unit: 'each',
          default_cost: 0,
          min_level: 0,
          max_level: 0,
          reorder_point: 0,
          is_serialized: false,
          is_charger: false,
          supplier_id: ''
        });
      }
    }
  }, [open, editItem]);

  // Fetch suppliers - using type assertion since inventory_suppliers might not be in types yet
  const { data: suppliers = [] } = useQuery({
    queryKey: ['inventory-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_suppliers' as any)
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Supplier[];
    }
  });

  const createItemMutation = useMutation({
    mutationFn: async (itemData: typeof formData) => {
      const payload = {
        ...itemData,
        supplier_id: itemData.supplier_id || null,
        description: itemData.description || null
      };

      if (isEditing && editItem) {
        const { data, error } = await supabase
          .from('inventory_items')
          .update(payload)
          .eq('id', editItem.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('inventory_items')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Item ${isEditing ? 'updated' : 'added'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} item:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${isEditing ? 'update' : 'create'} item`,
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

    createItemMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Item Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter item name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              value={formData.sku}
              onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
              placeholder="Enter SKU/part number"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter item description"
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select 
                value={formData.unit} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">Each</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                  <SelectItem value="meter">Meter</SelectItem>
                  <SelectItem value="kg">Kilogram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_cost">Default Cost (£)</Label>
              <Input
                id="default_cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.default_cost}
                onChange={(e) => setFormData(prev => ({ ...prev, default_cost: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_level">Min Level</Label>
              <Input
                id="min_level"
                type="number"
                min="0"
                value={formData.min_level}
                onChange={(e) => setFormData(prev => ({ ...prev, min_level: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reorder_point">Reorder Point</Label>
              <Input
                id="reorder_point"
                type="number"
                min="0"
                value={formData.reorder_point}
                onChange={(e) => setFormData(prev => ({ ...prev, reorder_point: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_level">Max Level</Label>
              <Input
                id="max_level"
                type="number"
                min="0"
                value={formData.max_level}
                onChange={(e) => setFormData(prev => ({ ...prev, max_level: parseInt(e.target.value) || 0 }))}
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
                <SelectItem value="">No supplier</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_serialized"
                checked={formData.is_serialized}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_serialized: checked }))}
              />
              <Label htmlFor="is_serialized">Serialized Item</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_charger"
                checked={formData.is_charger}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_charger: checked }))}
              />
              <Label htmlFor="is_charger">Charger (High Value Item)</Label>
            </div>
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
              disabled={createItemMutation.isPending}
            >
              {createItemMutation.isPending ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update Item" : "Add Item")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
