import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface EditPurchaseOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string | null;
}

interface POItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  received_quantity: number;
}

export function EditPurchaseOrderModal({ open, onOpenChange, purchaseOrderId }: EditPurchaseOrderModalProps) {
  const [supplierId, setSupplierId] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [poItems, setPoItems] = useState<POItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      return data?.role === 'admin';
    },
    enabled: !!user?.id
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_suppliers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch purchase order details
  const { data: purchaseOrder, isLoading } = useQuery({
    queryKey: ['purchase-order-edit', purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return null;
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          engineers!purchase_orders_engineer_id_fkey(id, name, email),
          purchase_order_lines(
            id, 
            item_name, 
            quantity, 
            unit_cost, 
            line_total, 
            received_quantity,
            item_id,
            inventory_items(name, sku)
          )
        `)
        .eq('id', purchaseOrderId)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    },
    enabled: !!purchaseOrderId && open
  });

  // Populate form when purchase order data loads
  useEffect(() => {
    if (purchaseOrder) {
      setSupplierId(purchaseOrder.supplier_id || "");
      setExpectedDelivery(purchaseOrder.expected_delivery_date || "");
      setNotes(purchaseOrder.notes || "");
      setStatus(purchaseOrder.status);
      
      const items = purchaseOrder.purchase_order_lines?.map((line: any) => ({
        id: line.id,
        item_name: line.inventory_items?.name || line.item_name || '',
        quantity: line.quantity,
        unit_cost: line.unit_cost,
        line_total: line.line_total,
        received_quantity: line.received_quantity
      })) || [];
      
      setPoItems(items);
    }
  }, [purchaseOrder]);

  const addItem = () => {
    setPoItems([...poItems, { 
      id: `new-${Date.now()}`,
      item_name: "",
      quantity: 1,
      unit_cost: 0,
      line_total: 0,
      received_quantity: 0
    }]);
  };

  const removeItem = (id: string) => {
    setPoItems(poItems.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof POItem, value: any) => {
    setPoItems(prevItems => 
      prevItems.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unit_cost') {
            updatedItem.line_total = updatedItem.quantity * updatedItem.unit_cost;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const totalAmount = poItems.reduce((sum, item) => sum + item.line_total, 0);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!purchaseOrderId) throw new Error('No purchase order ID');
      
      // Delete purchase order lines first
      await supabase
        .from('purchase_order_lines')
        .delete()
        .eq('purchase_order_id', purchaseOrderId);
      
      // Then delete the purchase order
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', purchaseOrderId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Purchase order deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-metrics'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete purchase order",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    if (!supplierId || poItems.some(item => !item.item_name || !item.quantity)) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Updating purchase order with data:', {
        supplierId,
        expectedDelivery,
        notes,
        status,
        totalAmount,
        poItems
      });

      // Update the purchase order
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          supplier_id: supplierId,
          expected_delivery_date: expectedDelivery || null,
          notes,
          status: status as 'pending' | 'approved' | 'received' | 'cancelled',
          total_amount: totalAmount
        })
        .eq('id', purchaseOrderId);

      if (poError) {
        console.error('Purchase order update error:', poError);
        throw poError;
      }

      // Handle purchase order lines updates
      const existingItems = poItems.filter(item => !item.id.startsWith('new-'));
      const newItems = poItems.filter(item => item.id.startsWith('new-'));

      console.log('Existing items to update:', existingItems);
      console.log('New items to insert:', newItems);

      // Update existing items
      for (const item of existingItems) {
        console.log('Updating item:', item.id, item);
        const { error } = await supabase
          .from('purchase_order_lines')
          .update({
            item_name: item.item_name,
            quantity: item.quantity,
            unit_cost: item.unit_cost
          })
          .eq('id', item.id);
          
        if (error) {
          console.error('Item update error:', error);
          throw error;
        }
      }

      // Insert new items
      if (newItems.length > 0) {
        const { error } = await supabase
          .from('purchase_order_lines')
          .insert(newItems.map(item => ({
            purchase_order_id: purchaseOrderId,
            item_id: null, // No linked inventory item for manually created items
            item_name: item.item_name,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            received_quantity: 0
          })));
          
        if (error) throw error;
      }
      
      toast({
        title: "Success",
        description: "Purchase order updated successfully",
      });

      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-edit', purchaseOrderId] });

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating purchase order:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update purchase order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!purchaseOrder) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Purchase Order - {purchaseOrder.po_number}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="engineer">Engineer</Label>
              <Input
                id="engineer"
                value={purchaseOrder.engineers?.name || "Not assigned"}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expected-delivery">Expected Delivery</Label>
              <Input
                id="expected-delivery"
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {poItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-4">
                      <Label>Item Name</Label>
                      <Input
                        value={item.item_name}
                        onChange={(e) => updateItem(item.id, "item_name", e.target.value)}
                        placeholder="Item name"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                        min="1"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Unit Cost</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(item.id, "unit_cost", parseFloat(e.target.value) || 0)}
                        min="0"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Total</Label>
                      <div className="h-10 flex items-center px-3 border rounded bg-muted">
                        £{item.line_total.toFixed(2)}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="text-right">
              <p className="text-lg font-semibold">Total: £{totalAmount.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for this purchase order"
              rows={3}
            />
          </div>

          <div className="flex justify-between">
            <div>
              {isAdmin && (
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive">
                      Delete Purchase Order
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the purchase order and all its items. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Purchase Order'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}