import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeApiCall, showErrorToast, showSuccessToast } from '@/utils/apiErrorHandler';

interface MaterialUsed {
  id: string;
  order_id: string;
  engineer_id: string;
  item_id?: string;
  item_name: string;
  quantity: number;
  serial_number?: string;
  location_id?: string;
  notes?: string;
  used_at: string;
  inventory_items?: {
    name: string;
    sku: string;
  };
  inventory_locations?: {
    name: string;
    code?: string;
  };
}

interface RecordMaterialUsageParams {
  orderId: string;
  engineerId: string;
  itemId?: string;
  itemName: string;
  quantity: number;
  serialNumber?: string;
  locationId?: string;
  notes?: string;
  deductStock?: boolean;
}

export function useMaterialsUsed(orderId?: string) {
  return useQuery({
    queryKey: ['materials-used', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      
      const { data, error } = await supabase
        .from('engineer_materials_used')
        .select(`
          *,
          inventory_items(name, sku),
          inventory_locations(name, code)
        `)
        .eq('order_id', orderId)
        .order('used_at', { ascending: false });

      if (error) throw error;
      return data as MaterialUsed[];
    },
    enabled: !!orderId
  });
}

export function useRecordMaterialUsage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: RecordMaterialUsageParams) => {
      const { data, error } = await supabase.rpc('record_material_usage', {
        p_order_id: params.orderId,
        p_engineer_id: params.engineerId,
        p_item_id: params.itemId || null,
        p_item_name: params.itemName,
        p_quantity: params.quantity,
        p_serial_number: params.serialNumber || null,
        p_location_id: params.locationId || null,
        p_notes: params.notes || null,
        p_deduct_stock: params.deductStock || false
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['materials-used', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      toast({
        title: "Material Recorded",
        description: `${variables.itemName} has been added to job materials`,
      });
    },
    onError: (error) => {
      console.error('Error recording material usage:', error);
      toast({
        title: "Error",
        description: "Failed to record material usage",
        variant: "destructive",
      });
    }
  });
}

export function useRevokeMaterialUsage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ usageId, restoreStock }: { usageId: string; restoreStock?: boolean }) => {
      const { data, error } = await supabase.rpc('revoke_material_usage', {
        p_usage_id: usageId,
        p_restore_stock: restoreStock || false
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials-used'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      toast({
        title: "Material Usage Revoked",
        description: "Material usage has been removed from the job",
      });
    },
    onError: (error) => {
      console.error('Error revoking material usage:', error);
      toast({
        title: "Error",
        description: "Failed to revoke material usage",
        variant: "destructive",
      });
    }
  });
}