
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StockRequest, StockRequestWithDetails, CreateStockRequestData, StockRequestStatus } from '@/types/stock-request';
import { safeApiCall, showErrorToast, showSuccessToast } from '@/utils/apiErrorHandler';
//import { toast } from 'sonner'; // Removed - use showErrorToast/showSuccessToast from apiErrorHandler

export const useStockRequests = (engineerId?: string, limit = 30) => {
  return useQuery({
    queryKey: ['stock-requests', engineerId, limit],
    queryFn: async () => {
      console.log('useStockRequests: Fetching stock requests', { engineerId, limit });
      
      let query = supabase
        .from('stock_requests')
        .select(`
          *,
          lines:stock_request_lines(
            *,
            item:inventory_items(name, sku, unit)
          ),
          engineer:engineers(name),
          destination_location:inventory_locations(name),
          order:orders(order_number, client_id)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (engineerId) {
        console.log('useStockRequests: Filtering by engineer_id:', engineerId);
        query = query.eq('engineer_id', engineerId);
      }

      const { data, error } = await query;
      
      console.log('useStockRequests: Query result', { data, error, dataLength: data?.length });
      
      if (error) {
        console.error('useStockRequests: Query error:', error);
        throw error;
      }
      
      return (data as unknown) as StockRequestWithDetails[];
    }
  });
};

export const useCreateStockRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestData: CreateStockRequestData & { engineer_id: string }) => {
      const { lines, ...requestFields } = requestData;
      
      // Generate idempotency key
      const idempotencyKey = crypto.randomUUID();
      
      console.log('Creating stock request with data:', { ...requestFields, idempotency_key: idempotencyKey });
      
      // Create the main request
      const { data: request, error: requestError } = await supabase
        .from('stock_requests')
        .insert([{
          ...requestFields,
          idempotency_key: idempotencyKey
        }])
        .select()
        .single();

      if (requestError) {
        console.error('Stock request creation error:', requestError);
        throw requestError;
      }

      console.log('Stock request created:', request);

      // Create the lines
      if (lines.length > 0) {
        console.log('Creating stock request lines:', lines);
        const { error: linesError } = await supabase
          .from('stock_request_lines')
          .insert(
            lines.map(line => ({
              ...line,
              request_id: request.id
            }))
          );

        if (linesError) {
          console.error('Stock request lines creation error:', linesError);
          throw linesError;
        }
      }

      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
      showSuccessToast('Stock request submitted successfully');
    },
    onError: (error) => {
      console.error('Failed to create stock request:', error);
      showErrorToast('Failed to submit stock request');
    }
  });
};

export const useUpdateStockRequestStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      console.log('Attempting to update stock request status:', { id, status, notes });
      
      // Update the stock request status
      const { data, error } = await (supabase as any)
        .from('stock_requests')
        .update({ 
          status: status as any,
          notes: notes || undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Database error when updating status:', error);
        throw error;
      }

      // If status is 'received', create inventory transactions to add stock to the engineer's van
      if (status === 'received') {
        console.log('Status changed to received - creating inventory transactions for request:', id);
        
        // Get the stock request lines to know what items and quantities to add
        const { data: requestLines, error: linesError } = await supabase
          .from('stock_request_lines')
          .select('item_id, qty')
          .eq('request_id', id);

        if (linesError) {
          console.error('Failed to fetch stock request lines:', linesError);
          throw linesError;
        }

        if (requestLines && requestLines.length > 0) {
          // Create inventory transactions for each item
          const transactions = requestLines.map(line => ({
            item_id: line.item_id,
            location_id: data.destination_location_id,
            qty: line.qty,
            direction: 'in',
            status: 'approved',
            notes: `Stock received from request #${id.slice(0, 8)}`,
            reference: `Stock Request: ${id}`,
            approved_at: new Date().toISOString()
          }));

          const { error: txnError } = await supabase
            .from('inventory_txns')
            .insert(transactions);

          if (txnError) {
            console.error('Failed to create inventory transactions:', txnError);
            throw txnError;
          }

          console.log('Successfully created inventory transactions for received stock');
        }
      }

      // If the status is being changed to 'cancelled', also void any associated purchase order
      if (status === 'cancelled' && data.purchase_order_id) {
        console.log('Cancelling associated purchase order:', data.purchase_order_id);
        
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({ 
            status: 'cancelled',
            notes: `Voided due to cancelled stock request #${id.slice(0, 8)}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.purchase_order_id)
          .eq('status', 'pending'); // Only update if still pending to avoid conflicts

        if (poError) {
          console.error('Failed to cancel purchase order:', poError);
          // Don't throw here - stock request was updated successfully
          // Just log the PO cancellation failure
        } else {
          console.log('Successfully cancelled purchase order:', data.purchase_order_id);
        }
      }
      
      console.log('Status update successful:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      // Invalidate inventory queries to refresh stock counts
      queryClient.invalidateQueries({ queryKey: ['engineer-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['van-stock'] });
      queryClient.invalidateQueries({ queryKey: ['van-stock-metrics'] });
      
      if (variables.status === 'cancelled' && data?.purchase_order_id) {
        showSuccessToast('Stock request cancelled and associated purchase order voided');
      } else if (variables.status === 'received') {
        showSuccessToast('Stock received and added to van inventory');
      } else {
        showSuccessToast('Request status updated');
      }
    },
    onError: (error) => {
      console.error('Failed to update request status:', error);
      showErrorToast('Failed to update request status');
    }
  });
};

export const useUpdateStockRequestLines = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      lines, 
      status = 'submitted' 
    }: { 
      requestId: string; 
      lines: Array<{ item_id: string; qty: number; notes?: string }>; 
      status?: StockRequestStatus;
    }) => {
      // Delete existing lines
      const { error: deleteError } = await supabase
        .from('stock_request_lines')
        .delete()
        .eq('request_id', requestId);

      if (deleteError) throw deleteError;

      // Insert new lines if any
      if (lines.length > 0) {
        const { error: insertError } = await supabase
          .from('stock_request_lines')
          .insert(
            lines.map(line => ({
              ...line,
              request_id: requestId
            }))
          );

        if (insertError) throw insertError;
      }

      // Update request status
      const { data, error } = await supabase
        .from('stock_requests')
        .update({ 
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
      showSuccessToast('Stock request updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update stock request:', error);
      showErrorToast('Failed to update stock request');
    }
  });
};

export const useDeleteStockRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      // Check if the stock request is linked to any purchase orders
      const { data: linkedPOs, error: poCheckError } = await supabase
        .from('purchase_orders')
        .select('id, po_number')
        .eq('stock_request_id', requestId);

      if (poCheckError) throw poCheckError;

      if (linkedPOs && linkedPOs.length > 0) {
        throw new Error(`Cannot delete stock request - it is linked to purchase order(s): ${linkedPOs.map(po => po.po_number).join(', ')}`);
      }

      // First delete all related lines
      const { error: linesError } = await supabase
        .from('stock_request_lines')
        .delete()
        .eq('request_id', requestId);

      if (linesError) throw linesError;

      // Then delete the request
      const { error: requestError } = await supabase
        .from('stock_requests')
        .delete()
        .eq('id', requestId);

      if (requestError) throw requestError;

      return requestId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
      showSuccessToast('Stock request deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete stock request:', error);
      if (error.message.includes('linked to purchase order')) {
        showErrorToast(error.message);
      } else {
        showErrorToast('Failed to delete stock request');
      }
    }
  });
};
