
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Package } from "lucide-react";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  is_serialized: boolean;
  default_cost: number;
  unit: string;
  min_level: number;
  max_level: number;
  reorder_point: number;
  supplier_id?: string;
  is_active: boolean;
}

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: InventoryItem | null;
}

export function AddItemModal({ open, onOpenChange, editingItem }: AddItemModalProps) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSerializedState, setIsSerializedState] = useState(false);
  const [defaultCost, setDefaultCost] = useState("");
  const [unit, setUnit] = useState("each");
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetForm = () => {
    setSku("");
    setName("");
    setDescription("");
    setIsSerializedState(false);
    setDefaultCost("");
    setUnit("each");
    setMinLevel("");
    setMaxLevel("");
    setReorderPoint("");
    setSupplierId("");
  };

  // Populate form when editing
  useEffect(() => {
    if (editingItem) {
      setSku(editingItem.sku);
      setName(editingItem.name);
      setDescription(editingItem.description || "");
      setIsSerializedState(editingItem.is_serialized);
      setDefaultCost(editingItem.default_cost.toString());
      setUnit(editingItem.unit);
      setMinLevel(editingItem.min_level.toString());
      setMaxLevel(editingItem.max_level.toString());
      setReorderPoint(editingItem.reorder_point.toString());
      setSupplierId(editingItem.supplier_id || "");
    } else {
      resetForm();
    }
  }, [editingItem, open]);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (itemData: {
      sku: string;
      name: string;
      description?: string;
      is_serialized: boolean;
      default_cost: number;
      unit: string;
      min_level: number;
      max_level: number;
      reorder_point: number;
      supplier_id?: string;
    }) => {
      if (editingItem) {
        // Update existing item
        const { data, error } = await supabase
          .from('inventory_items')
          .update(itemData)
          .eq('id', editingItem.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Add new item
        const { data, error } = await supabase
          .from('inventory_items')
          .insert([itemData])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: editingItem ? "Item updated successfully" : "Item added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-items-simple"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${editingItem ? 'update' : 'add'} item: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) return;

    addItemMutation.mutate({
      sku: sku.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      is_serialized: isSerializedState,
      default_cost: parseFloat(defaultCost) || 0,
      unit,
      min_level: parseInt(minLevel) || 0,
      max_level: parseInt(maxLevel) || 0,
      reorder_point: parseInt(reorderPoint) || 0,
      supplier_id: supplierId || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {editingItem ? 'Edit Item' : 'Add New Item'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="ITEM-001"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Item Name"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Item description..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="defaultCost">Default Cost (£)</Label>
              <Input
                id="defaultCost"
                type="number"
                step="0.01"
                min="0"
                value={defaultCost}
                onChange={(e) => setDefaultCost(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="unit">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">Each</SelectItem>
                  <SelectItem value="meter">Meter</SelectItem>
                  <SelectItem value="kg">Kilogram</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="pack">Pack</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="minLevel">Min Level</Label>
              <Input
                id="minLevel"
                type="number"
                min="0"
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="maxLevel">Max Level</Label>
              <Input
                id="maxLevel"
                type="number"
                min="0"
                value={maxLevel}
                onChange={(e) => setMaxLevel(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="reorderPoint">Reorder Point</Label>
              <Input
                id="reorderPoint"
                type="number"
                min="0"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="supplier">Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier (optional)" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_serialized"
              checked={isSerializedState}
              onCheckedChange={setIsSerializedState}
            />
            <Label htmlFor="is_serialized">Serialized Item</Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={addItemMutation.isPending}
            >
              {addItemMutation.isPending 
                ? (editingItem ? "Updating..." : "Adding...") 
                : (editingItem ? "Update Item" : "Add Item")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
