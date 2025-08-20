
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddItemModal } from "./AddItemModal";

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
  suppliers?: {
    name: string;
  } | null;
}

export function InventoryItemsSimple() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = React.useState<InventoryItem | null>(null);
  const [addItemOpen, setAddItemOpen] = React.useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          suppliers (
            name
          )
        `)
        .order('name');
      
      if (error) throw error;
      return data as InventoryItem[];
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string, is_active: boolean }) => {
      const { data, error } = await supabase
        .from('inventory_items')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      toast({
        title: "Success",
        description: "Item status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update item status",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    {item.is_charger && (
                      <Badge className="bg-purple-100 text-purple-800">
                        Charger
                      </Badge>
                    )}
                    {item.is_serialized && (
                      <Badge variant="outline">
                        Serialized
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={item.is_active ? "default" : "destructive"}>
                    {item.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Unit: </span>
                  <span>{item.unit}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cost: </span>
                  <span>£{item.default_cost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Min/Max: </span>
                  <span>{item.min_level}/{item.max_level}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reorder: </span>
                  <span>{item.reorder_point}</span>
                </div>
              </div>

              {item.suppliers && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Supplier: </span>
                  <span>{item.suppliers.name}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setEditingItem(item);
                    setAddItemOpen(true);
                  }}
                >
                  Edit Item
                </Button>
                <Button 
                  variant={item.is_active ? "destructive" : "default"}
                  size="sm"
                  onClick={() => toggleActiveMutation.mutate({
                    id: item.id,
                    is_active: !item.is_active
                  })}
                  disabled={toggleActiveMutation.isPending}
                >
                  {item.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No items found. Add your first inventory item to get started.
        </div>
      )}

      <AddItemModal 
        open={addItemOpen} 
        onOpenChange={(open) => {
          setAddItemOpen(open);
          if (!open) setEditingItem(null);
        }}
        editItem={editingItem}
      />
    </div>
  );
}
