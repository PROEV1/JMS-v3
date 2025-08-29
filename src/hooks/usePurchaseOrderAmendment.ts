import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AmendPurchaseOrderData {
  purchaseOrderId: string;
  items: Array<{
    item_id: string;
    quantity: number;
    notes?: string;
  }>;
  amendmentReason: string;
  engineerId: string;
}

interface PurchaseOrderLine {
  id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  item: {
    name: string;
    sku: string;
  };
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  notes: string;
  supplier_id: string;
  stock_request_id: string;
  purchase_order_lines: PurchaseOrderLine[];
}

export const usePurchaseOrderForStockRequest = (stockRequestId?: string) => {
  return useQuery({
    queryKey: ['purchase-order-for-stock-request', stockRequestId],
    queryFn: async () => {
      if (!stockRequestId) return null;

      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          purchase_order_lines(
            *,
            item:inventory_items(name, sku)
          )
        `)
        .eq('stock_request_id', stockRequestId)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;
      return data as PurchaseOrder | null;
    },
    enabled: !!stockRequestId
  });
};

export const useAmendPurchaseOrder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ purchaseOrderId, items, amendmentReason, engineerId }: AmendPurchaseOrderData) => {
      // Get current PO details
      const { data: currentPO, error: fetchError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          purchase_order_lines(*)
        `)
        .eq('id', purchaseOrderId)
        .single();

      if (fetchError) throw fetchError;

      // Update PO with amendment notes
      const amendmentNote = `\n\n=== AMENDMENT ===\nReason: ${amendmentReason}\nAmended by Engineer: ${engineerId}\nAmended at: ${new Date().toISOString()}\n`;
      
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          notes: (currentPO.notes || '') + amendmentNote,
          status: 'pending', // Keep as pending but add amendment notes
          updated_at: new Date().toISOString()
        })
        .eq('id', purchaseOrderId);

      if (updateError) throw updateError;

      // Delete existing lines
      const { error: deleteError } = await supabase
        .from('purchase_order_lines')
        .delete()
        .eq('purchase_order_id', purchaseOrderId);

      if (deleteError) throw deleteError;

      // Insert new/amended lines
      const newLines = items.map((item, index) => ({
        purchase_order_id: purchaseOrderId,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_cost: 0, // Will be filled by admin
        line_number: index + 1,
        notes: item.notes || 'Amended by engineer'
      }));

      const { error: insertError } = await supabase
        .from('purchase_order_lines')
        .insert(newLines);

      if (insertError) throw insertError;

      return { purchaseOrderId, amendedLines: newLines.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-for-stock-request'] });
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
      
      toast({
        title: "Purchase Order Amended",
        description: `Successfully amended PO with ${data.amendedLines} items. Status remains pending for admin review.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Amendment Failed",
        description: error.message || "Failed to amend purchase order. Please try again.",
        variant: "destructive",
      });
    }
  });
};