
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StockRequest, StockRequestWithDetails, CreateStockRequestData } from '@/types/stock-request';
import { safeApiCall, showErrorToast, showSuccessToast } from '@/utils/apiErrorHandler';
//import { toast } from 'sonner'; // Removed - use showErrorToast/showSuccessToast from apiErrorHandler

export const useStockRequests = (engineerId?: string, limit = 30) => {
  return useQuery({
    queryKey: ['stock-requests', engineerId, limit],
    queryFn: async () => {
      let query = (supabase as any)
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
        query = query.eq('engineer_id', engineerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
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

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
      showSuccessToast('Request status updated');
    },
    onError: (error) => {
      console.error('Failed to update request status:', error);
      showErrorToast('Failed to update request status');
    }
  });
};
