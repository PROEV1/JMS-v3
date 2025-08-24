import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { safeApiCall, showErrorToast, showSuccessToast } from '@/utils/apiErrorHandler';

// Enhanced inventory hook with real-time updates and caching
export function useInventoryEnhanced() {
  const queryClient = useQueryClient();

  // Get all inventory items with enhanced data
  const useInventoryItems = (filters: any = {}) => {
    return useQuery({
      queryKey: ['inventory-items', filters],
      queryFn: async () => {
        let query = supabase
          .from('inventory_items')
          .select(`
            *,
            inventory_suppliers(name),
            stock_balances:inventory_txns(item_id, location_id, qty, direction)
          `)
          .eq('is_active', true);

        // Apply basic filters only
        if (filters.supplier) query = query.eq('supplier_id', filters.supplier);
        if (filters.serialized !== undefined) query = query.eq('is_serialized', filters.serialized);

        query = query.order('name');

        const { data, error } = await query;
        if (error) throw error;

        // Calculate current stock levels for each item
        return data?.map((item: any) => ({
          ...item,
          current_stock: calculateCurrentStock(item.stock_balances || []),
          supplier_name: item.inventory_suppliers?.name
        })) || [];
      },
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  // Get low stock items
  const useLowStockItems = () => {
    return useQuery({
      queryKey: ['low-stock-items'],
      queryFn: async () => {
        const { data } = await supabase
          .from('inventory_items')
          .select(`
            *,
            inventory_suppliers(name)
          `)
          .eq('is_active', true);

        if (!data) return [];

        // Get stock balances
        const { data: balances } = await supabase.rpc('get_item_location_balances');

        // Filter items with low stock
        return data.filter(item => {
          const itemBalances = balances?.filter((b: any) => b.item_id === item.id) || [];
          const totalStock = itemBalances.reduce((sum: number, balance: any) => sum + balance.on_hand, 0);
          return totalStock <= item.reorder_point;
        }).map((item: any) => ({
          ...item,
          supplier_name: item.inventory_suppliers?.name
        }));
      },
      staleTime: 60 * 1000, // 1 minute
    });
  };

  // Get inventory KPI stats
  const useInventoryKPIs = () => {
    return useQuery({
      queryKey: ['inventory-kpis'],
      queryFn: async () => {
        const [itemsRes, balancesRes, requestsRes] = await Promise.all([
          supabase.from('inventory_items').select('id, is_active, reorder_point').eq('is_active', true),
          supabase.rpc('get_item_location_balances'),
          supabase.from('stock_requests').select('status, created_at')
        ]);

        const items = itemsRes.data || [];
        const balances = balancesRes.data || [];
        const requests = requestsRes.data || [];

        // Calculate KPIs
        const activeItems = items.length;
        const lowStockItems = items.filter(item => {
          const itemBalances = balances.filter((b: any) => b.item_id === item.id);
          const totalStock = itemBalances.reduce((sum: number, balance: any) => sum + balance.on_hand, 0);
          return totalStock <= item.reorder_point;
        }).length;

        const today = new Date().toISOString().split('T')[0];
        const submittedRequests = requests.filter(r => r.status === 'submitted').length;
        const deliveredToday = requests.filter(r => 
          r.status === 'delivered' && r.created_at.startsWith(today)
        ).length;

        return {
          activeItems,
          lowStockItems,
          submittedRequests,
          deliveredToday,
          totalValue: balances.reduce((sum: number, b: any) => sum + b.on_hand, 0)
        };
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  // Create stock adjustment mutation
  const createStockAdjustment = useMutation({
    mutationFn: async ({ itemId, locationId, quantity, reason, notes }: {
      itemId: string;
      locationId: string;
      quantity: number;
      reason: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: itemId,
          location_id: locationId,
          direction: 'adjust',
          qty: quantity,
          reference: `Stock adjustment: ${reason}`,
          notes
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
      toast.success('Stock adjustment completed');
    },
    onError: (error) => {
      toast.error('Failed to adjust stock: ' + error.message);
    }
  });

  // Create stock transfer mutation
  const createStockTransfer = useMutation({
    mutationFn: async ({ itemId, fromLocationId, toLocationId, quantity, notes }: {
      itemId: string;
      fromLocationId: string;
      toLocationId: string;
      quantity: number;
      notes?: string;
    }) => {
      const reference = `Transfer ${quantity} units`;

      // Create outbound transaction
      const { error: outError } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: itemId,
          location_id: fromLocationId,
          direction: 'out',
          qty: quantity,
          reference,
          notes
        });

      if (outError) throw outError;

      // Create inbound transaction
      const { data, error } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: itemId,
          location_id: toLocationId,
          direction: 'in',
          qty: quantity,
          reference,
          notes
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      toast.success('Stock transfer completed');
    },
    onError: (error) => {
      toast.error('Failed to transfer stock: ' + error.message);
    }
  });

  // Bulk operations
  const bulkUpdateItems = useMutation({
    mutationFn: async ({ itemIds, updates }: {
      itemIds: string[];
      updates: Record<string, any>;
    }) => {
      const { data, error } = await supabase
        .from('inventory_items')
        .update(updates)
        .in('id', itemIds)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success(`Updated ${data.length} items`);
    },
    onError: (error) => {
      toast.error('Failed to update items: ' + error.message);
    }
  });

  // Cache invalidation helpers
  const invalidateInventoryCache = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
  };

  return {
    useInventoryItems,
    useLowStockItems,
    useInventoryKPIs,
    createStockAdjustment,
    createStockTransfer,
    bulkUpdateItems,
    invalidateInventoryCache
  };
}

// Helper function to calculate current stock
function calculateCurrentStock(transactions: any[]): number {
  return transactions.reduce((total, txn) => {
    switch (txn.direction) {
      case 'in':
      case 'adjust':
        return total + txn.qty;
      case 'out':
        return total - txn.qty;
      default:
        return total;
    }
  }, 0);
}

// Real-time subscription hook
export function useInventorySubscription() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const subscription = supabase
      .channel('inventory-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'inventory_txns' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-kpis'] });
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
}