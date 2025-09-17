import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { safeApiCall, showErrorToast, showSuccessToast } from '@/utils/apiErrorHandler';

// Enhanced inventory hook with real-time updates and caching
export function useInventoryEnhanced() {
  const queryClient = useQueryClient();

  // Get all inventory items with enhanced data
  const useInventoryItems = (filters: any = {}) => {
    return useQuery({
      queryKey: ['inventory-items', filters],
      queryFn: async () => {
        console.log('useInventoryItems: Fetching inventory items...');
        
        let query = supabase
          .from('inventory_items')
          .select('*')
          .eq('is_active', true);

        // Apply basic filters only
        if (filters.supplier) query = query.eq('supplier_id', filters.supplier);
        if (filters.serialized !== undefined) query = query.eq('is_serialized', filters.serialized);

        query = query.order('name');

        const { data, error } = await query;
        
        if (error) {
          console.error('useInventoryItems: Error fetching items:', error);
          throw error;
        }

        console.log('useInventoryItems: Fetched items:', data?.length || 0);
        
        return data || [];
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

        // Get stock balances using direct query - ONLY approved transactions
        const { data: txnsData } = await supabase
          .from('inventory_txns')
          .select('item_id, location_id, direction, qty, status')
          .eq('status', 'approved');
        
        // Calculate balances manually with proper adjust handling
        const balances = new Map<string, { item_id: string; location_id: string; on_hand: number }>();
        
        txnsData?.forEach(txn => {
          const key = `${txn.item_id}-${txn.location_id}`;
          const current = balances.get(key) || { item_id: txn.item_id, location_id: txn.location_id, on_hand: 0 };
          
          if (txn.direction === 'in') {
            current.on_hand += txn.qty;
          } else if (txn.direction === 'out') {
            current.on_hand -= txn.qty;
          } else if (txn.direction === 'adjust') {
            // For adjustments, qty is already positive or negative as intended
            current.on_hand += txn.qty;
          }
          
          balances.set(key, current);
        });
        
        const balancesArray = Array.from(balances.values());

        // Filter items with low stock
        return data.filter(item => {
          const itemBalances = balancesArray?.filter((b: any) => b.item_id === item.id) || [];
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
        const [itemsRes, balancesRes, requestsRes, vanLocationsRes] = await Promise.all([
          supabase.from('inventory_items').select('id, is_active, reorder_point').eq('is_active', true),
          supabase.rpc('get_item_location_balances'),
          supabase.from('stock_requests').select('status, created_at'),
          supabase.from('inventory_locations').select('id').eq('is_active', true).eq('type', 'van')
        ]);

        const items = itemsRes.data || [];
        const balances = balancesRes.data || [];
        const requests = requestsRes.data || [];
        const vanLocations = vanLocationsRes.data || [];

        // Calculate KPIs
        const activeItems = items.length;
        
        // Count low stock items specifically at engineer van locations
        const lowStockItems = items.filter(item => {
          return vanLocations.some(vanLocation => {
            const balance = balances.find((b: any) => 
              b.item_id === item.id && b.location_id === vanLocation.id
            );
            return balance && balance.on_hand <= item.reorder_point;
          });
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
      console.log('Creating stock adjustment:', { itemId, locationId, quantity, reason, notes });
      
      const { data, error } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: itemId,
          location_id: locationId,
          direction: 'adjust',
          qty: quantity,
          reference: `Stock adjustment: ${reason}`,
          notes,
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) {
        console.error('Stock adjustment error:', error);
        throw error;
      }
      
      console.log('Stock adjustment success:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['item-location-balances'] });
      showSuccessToast('Stock adjustment completed');
    },
    onError: (error) => {
      console.error('Stock adjustment mutation error:', error);
      showErrorToast('Failed to adjust stock: ' + error.message);
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
      // Check if sufficient stock is available at source location using direct query
      const { data: txnsData } = await supabase
        .from('inventory_txns')
        .select('item_id, location_id, direction, qty, status')
        .eq('status', 'approved')
        .eq('item_id', itemId)
        .eq('location_id', fromLocationId);
      
      let sourceBalance = 0;
      txnsData?.forEach(txn => {
        if (txn.direction === 'in' || txn.direction === 'adjust') {
          sourceBalance += txn.qty;
        } else {
          sourceBalance -= txn.qty;
        }
      });
      
      if (sourceBalance < quantity) {
        throw new Error(`Insufficient stock at source location. Available: ${sourceBalance}, Required: ${quantity}`);
      }

      const reference = `Transfer ${quantity} units`;

      // Create outbound transaction (auto-approved for internal transfers)
      const { error: outError } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: itemId,
          location_id: fromLocationId,
          direction: 'out',
          qty: quantity,
          reference,
          notes,
          status: 'approved',
          approved_at: new Date().toISOString()
        });

      if (outError) throw outError;

      // Create inbound transaction (auto-approved for internal transfers)
      const { data, error } = await supabase
        .from('inventory_txns')
        .insert({
          item_id: itemId,
          location_id: toLocationId,
          direction: 'in',
          qty: quantity,
          reference,
          notes,
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      showSuccessToast('Stock transfer completed');
    },
    onError: (error) => {
      showErrorToast('Failed to transfer stock: ' + error.message);
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
      showSuccessToast(`Updated ${data.length} items`);
    },
    onError: (error) => {
      showErrorToast('Failed to update items: ' + error.message);
    }
  });

  // Cache invalidation helpers
  const invalidateInventoryCache = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock-engineer-details'] });
  };

  // Get inventory locations
  const useInventoryLocations = () => {
    return useQuery({
      queryKey: ['inventory-locations'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('inventory_locations')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        return data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  // Get item balances at all locations
  const useItemLocationBalances = (itemId?: string) => {
    return useQuery({
      queryKey: ['item-location-balances', itemId],
      queryFn: async () => {
        console.log('useItemLocationBalances: Fetching inventory transactions...');
        // Use direct query - ONLY approved transactions
        const { data, error } = await supabase
          .from('inventory_txns')
          .select(`
            item_id,
            location_id,
            direction,
            qty,
            status
          `)
          .eq('status', 'approved');
        
        if (error) {
          console.error('useItemLocationBalances: Error fetching transactions:', error);
          throw error;
        }
        
        console.log('useItemLocationBalances: Raw transactions:', data?.length || 0);
        
        // Calculate balances manually with proper adjust handling
        const balances = new Map<string, { item_id: string; location_id: string; on_hand: number }>();
        
        data?.forEach(txn => {
          const key = `${txn.item_id}-${txn.location_id}`;
          const current = balances.get(key) || { item_id: txn.item_id, location_id: txn.location_id, on_hand: 0 };
          
          if (txn.direction === 'in') {
            current.on_hand += txn.qty;
          } else if (txn.direction === 'out') {
            current.on_hand -= txn.qty;
          } else if (txn.direction === 'adjust') {
            // For adjustments, qty is already positive or negative as intended
            current.on_hand += txn.qty;
          }
          
          balances.set(key, current);
        });
        
        const result = Array.from(balances.values()).filter(b => b.on_hand > 0);
        console.log('useItemLocationBalances: Calculated balances:', result);
        
        // Filter by item if provided
        if (itemId) {
          const filtered = result.filter(balance => balance.item_id === itemId);
          console.log('useItemLocationBalances: Filtered by item:', filtered);
          return filtered;
        }
        
        return result;
      },
      staleTime: 30 * 1000, // 30 seconds
    });
  };

  // Delete inventory item mutation
  const deleteInventoryItem = useMutation({
    mutationFn: async (itemId: string) => {
      // Check if item has any transactions
      const { data: transactions } = await supabase
        .from('inventory_txns')
        .select('id')
        .eq('item_id', itemId)
        .limit(1);

      if (transactions && transactions.length > 0) {
        // Soft delete - archive the item
        const { error } = await supabase
          .from('inventory_items')
          .update({ is_active: false })
          .eq('id', itemId);
        
        if (error) throw error;
        return { archived: true };
      } else {
        // Hard delete - completely remove the item
        const { error } = await supabase
          .from('inventory_items')
          .delete()
          .eq('id', itemId);
        
        if (error) throw error;
        return { archived: false };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-kpis'] });
      
      if (result.archived) {
        showSuccessToast('Item archived (has transaction history)');
      } else {
        showSuccessToast('Item deleted permanently');
      }
    },
    onError: (error) => {
      showErrorToast('Failed to delete item: ' + error.message);
    }
  });

  // Get detailed low stock information by engineer
  const useLowStockEngineerDetails = () => {
    return useQuery({
      queryKey: ['low-stock-engineer-details'],
      queryFn: async () => {
        // Get van locations with engineers
        const { data: vanLocations, error: locationsError } = await supabase
          .from('inventory_locations')
          .select(`
            id,
            name,
            type,
            engineer_id,
            engineers(name, email)
          `)
          .eq('is_active', true)
          .eq('type', 'van');

        if (locationsError) throw locationsError;

        // Get stock balances using direct query - ONLY approved transactions
        const { data: txnsData, error: balancesError } = await supabase
          .from('inventory_txns')
          .select('item_id, location_id, direction, qty, status')
          .eq('status', 'approved');
        if (balancesError) throw balancesError;
        
        // Calculate balances manually with proper adjust handling
        const balancesMap = new Map<string, { item_id: string; location_id: string; on_hand: number }>();
        
         txnsData?.forEach(txn => {
           const key = `${txn.item_id}-${txn.location_id}`;
           const current = balancesMap.get(key) || { item_id: txn.item_id, location_id: txn.location_id, on_hand: 0 };
           
           if (txn.direction === 'in') {
             current.on_hand += txn.qty;
           } else if (txn.direction === 'out') {
             current.on_hand -= txn.qty;
           } else if (txn.direction === 'adjust') {
             // For adjustments, qty is already positive or negative as intended
             current.on_hand += txn.qty;
           }
           
           balancesMap.set(key, current);
         });
        
        const balances = Array.from(balancesMap.values());

        // Get items data
        const { data: items, error: itemsError } = await supabase
          .from('inventory_items')
          .select('id, name, sku, reorder_point')
          .eq('is_active', true);

        if (itemsError) throw itemsError;

        if (!vanLocations || !items || !balances) return [];

        const lowStockDetails: any[] = [];

        vanLocations.forEach(location => {
          // Get balances for this location (if any)
          const locationBalances = balances.filter((b: any) => b.location_id === location.id);
          
          // Only process items that have actually had transactions at this van location
          // This ensures we only show items that are supposed to be at this location
          locationBalances.forEach(balance => {
            const item = items.find(i => i.id === balance.item_id);
            if (!item) return;
            
            // Only show if current stock is at or below reorder point
            if (balance.on_hand <= item.reorder_point) {
              const shortage = Math.max(0, item.reorder_point - balance.on_hand);
              const status = balance.on_hand <= 0 ? 'out_of_stock' : 
                           balance.on_hand < item.reorder_point * 0.5 ? 'critical_low' : 'low_stock';
              
              lowStockDetails.push({
                location_id: location.id,
                location_name: location.name,
                engineer_id: location.engineer_id,
                engineer_name: location.engineers?.name || 'Unassigned',
                engineer_email: location.engineers?.email,
                item_id: item.id,
                item_name: item.name,
                item_sku: item.sku,
                current_stock: balance.on_hand,
                reorder_point: item.reorder_point,
                shortage,
                status
              });
            }
          });
        });

        return lowStockDetails.sort((a, b) => {
          // Sort by status severity first, then by engineer name
          const statusOrder = { out_of_stock: 0, critical_low: 1, low_stock: 2 };
          const statusDiff = statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
          if (statusDiff !== 0) return statusDiff;
          return a.engineer_name.localeCompare(b.engineer_name);
        });
      },
      staleTime: 60 * 1000, // 1 minute
    });
  };

  return {
    useInventoryItems,
    useLowStockItems,
    useInventoryKPIs,
    useInventoryLocations,
    useItemLocationBalances,
    useLowStockEngineerDetails,
    createStockAdjustment,
    createStockTransfer,
    bulkUpdateItems,
    deleteInventoryItem,
    invalidateInventoryCache
  };
}

// Helper function to calculate current stock
function calculateCurrentStock(transactions: any[]): number {
  return transactions.reduce((total, txn) => {
    if (txn.direction === 'in') {
      return total + txn.qty;
    } else if (txn.direction === 'out') {
      return total - txn.qty;
    } else if (txn.direction === 'adjust') {
      // For adjustments, qty can be positive or negative
      return total + txn.qty;
    }
    return total;
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