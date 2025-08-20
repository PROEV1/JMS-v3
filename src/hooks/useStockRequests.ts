
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StockRequest, StockRequestWithDetails, CreateStockRequestData } from '@/types/stock-request';
import { toast } from 'sonner';

export const useStockRequests = (engineerId?: string, limit = 30) => {
  return useQuery({
    queryKey: ['stock-requests', engineerId, limit],
    queryFn: async () => {
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
      
      // Create the main request
      const { data: request, error: requestError } = await supabase
        .from('stock_requests')
        .insert([{
          ...requestFields,
          idempotency_key: idempotencyKey
        }])
        .select()
        .single();

      if (requestError) throw requestError;

      // Create the lines
      if (lines.length > 0) {
        const { error: linesError } = await supabase
          .from('stock_request_lines')
          .insert(
            lines.map(line => ({
              ...line,
              request_id: request.id
            }))
          );

        if (linesError) throw linesError;
      }

      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
      toast.success('Stock request submitted successfully');
    },
    onError: (error) => {
      console.error('Failed to create stock request:', error);
      toast.error('Failed to submit stock request');
    }
  });
};

export const useUpdateStockRequestStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { data, error } = await supabase
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
      toast.success('Request status updated');
    },
    onError: (error) => {
      console.error('Failed to update request status:', error);
      toast.error('Failed to update request status');
    }
  });
};
