import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currency';

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
  total_amount: number;
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
      console.log('Starting PO amendment for:', purchaseOrderId);
      console.log('Items to amend:', items);
      
      // Check authentication first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication error:', authError);
        throw new Error('User not authenticated');
      }
      console.log('Authenticated user:', user.id);
      
      // Get current PO details with existing lines
      const { data: currentPO, error: fetchError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          purchase_order_lines(
            id,
            item_id,
            quantity,
            unit_cost,
            line_total,
            received_quantity
          )
        `)
        .eq('id', purchaseOrderId)
        .single();

      if (fetchError) {
        console.error('Error fetching PO:', fetchError);
        throw fetchError;
      }
      console.log('Current PO:', currentPO);

      // Get engineer's van location for stock adjustments
      const { data: vanLocation, error: locationError } = await supabase
        .rpc('get_engineer_van_location', { p_engineer_id: engineerId });

      if (locationError) {
        console.warn('Could not get engineer van location:', locationError);
      }
      console.log('Engineer van location:', vanLocation);

      // Calculate stock differences for inventory adjustments
      const stockDifferences = new Map();
      
      // Track old quantities
      currentPO.purchase_order_lines?.forEach((line: any) => {
        stockDifferences.set(line.item_id, {
          item_id: line.item_id,
          oldQuantity: line.quantity,
          newQuantity: 0, // Will be updated below
          unitCost: line.unit_cost
        });
      });

      // Update with new quantities and prepare line data
      const newLines = await Promise.all(items.map(async (item) => {
        // Update stock difference tracking
        const existing = stockDifferences.get(item.item_id) || { oldQuantity: 0, unitCost: 0 };
        stockDifferences.set(item.item_id, {
          ...existing,
          item_id: item.item_id,
          newQuantity: item.quantity
        });

        // Get unit cost - preserve existing or fetch from inventory item
        let unitCost = existing.unitCost || 0;
        
        if (unitCost === 0) {
          const { data: inventoryItem } = await supabase
            .from('inventory_items')
            .select('default_cost')
            .eq('id', item.item_id)
            .single();
          
          unitCost = inventoryItem?.default_cost || 0;
        }

        return {
          purchase_order_id: purchaseOrderId,
          item_id: item.item_id,
          quantity: item.quantity,
          unit_cost: unitCost,
          received_quantity: 0 // line_total is auto-calculated by database
        };
      }));

      console.log('New lines with proper costs:', newLines);

      // Update PO with amendment notes
      const amendmentNote = `\n\n=== AMENDMENT ===\nReason: ${amendmentReason}\nAmended by Engineer: ${engineerId}\nAmended at: ${new Date().toISOString()}\n`;
      
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          notes: (currentPO.notes || '') + amendmentNote,
          status: 'pending',
          amended_at: new Date().toISOString(),
          amended_by: engineerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', purchaseOrderId);

      if (updateError) {
        console.error('Error updating PO:', updateError);
        throw updateError;
      }

      // Delete existing lines
      const { error: deleteError } = await supabase
        .from('purchase_order_lines')
        .delete()
        .eq('purchase_order_id', purchaseOrderId);

      if (deleteError) {
        console.error('Error deleting PO lines:', deleteError);
        throw deleteError;
      }

      // Insert new lines with proper costs
      const { error: insertError } = await supabase
        .from('purchase_order_lines')
        .insert(newLines);

      if (insertError) {
        console.error('Error inserting PO lines:', insertError);
        throw insertError;
      }

      // Calculate and update PO totals
      const { error: totalsError } = await supabase
        .rpc('calculate_po_totals', { p_po_id: purchaseOrderId });

      if (totalsError) {
        console.error('Error calculating PO totals:', totalsError);
        throw totalsError;
      }

      // Create stock adjustment transactions if van location exists
      if (vanLocation) {
        for (const [itemId, diff] of stockDifferences) {
          const quantityChange = diff.newQuantity - diff.oldQuantity;
          
          if (quantityChange !== 0) {
            console.log(`Creating stock adjustment for item ${itemId}: ${quantityChange > 0 ? '+' : ''}${quantityChange}`);
            
            const { error: stockError } = await supabase
              .rpc('create_stock_adjustment_for_po_amendment', {
                p_item_id: itemId,
                p_location_id: vanLocation,
                p_quantity_change: quantityChange,
                p_po_id: purchaseOrderId,
                p_reference: `PO Amendment: ${currentPO.po_number}`
              });

            if (stockError) {
              console.error('Error creating stock adjustment:', stockError);
              // Don't throw - stock adjustment failure shouldn't fail the entire amendment
            }
          }
        }
      }

      // Mark stock request as received if this amendment came from a stock request
      if (currentPO.stock_request_id) {
        const { error: statusError } = await supabase
          .from('stock_requests')
          .update({ 
            status: 'received',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentPO.stock_request_id);

        if (statusError) {
          console.error('Error updating stock request status:', statusError);
          // Don't throw - status update failure shouldn't fail the entire amendment
        }
      }

      // Calculate total amendment value for display (manually since line_total is auto-calculated)
      const totalValue = newLines.reduce((sum, line) => sum + (line.quantity * line.unit_cost), 0);

      console.log('Amendment completed successfully');
      return { 
        purchaseOrderId, 
        amendedLines: newLines.length,
        totalValue,
        stockAdjustmentsCreated: vanLocation ? Array.from(stockDifferences.values()).filter(d => d.newQuantity !== d.oldQuantity).length : 0
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-for-stock-request'] });
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
      
      // Invalidate inventory queries to reflect stock changes
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['engineer-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-engineer-details'] });
      
      const totalValueFormatted = formatCurrency(data.totalValue);

      let description = `Successfully amended PO with ${data.amendedLines} items (Total: ${totalValueFormatted}).`;
      
      if (data.stockAdjustmentsCreated > 0) {
        description += ` ${data.stockAdjustmentsCreated} stock adjustments applied to your van inventory.`;
      }
      
      description += ` Status remains pending for admin review.`;
      
      toast({
        title: "Purchase Order Amended",
        description,
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