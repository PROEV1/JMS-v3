import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Virtual scrolling configuration
export const VIRTUAL_SCROLL_CONFIG = {
  itemHeight: 72, // Height of each table row in pixels
  overscan: 5, // Number of items to render outside visible area
  threshold: 100 // Start virtualization after this many items
};

// Background prefetching for dispatch data
export function useDispatchDataPrefetch() {
  const queryClient = useQueryClient();

  const prefetchNextPage = useCallback(async (currentPage: number, pageSize: number, filters: any) => {
    const nextPage = currentPage + 1;
    
    await queryClient.prefetchQuery({
      queryKey: ['charger-dispatch-data', { page: nextPage, pageSize, offset: (nextPage - 1) * pageSize }, filters],
      queryFn: async () => {
        // This would call the same function as useChargerDispatchData but for next page
        // Implementation would be similar to the main hook
        return { orders: [], totalCount: 0, stats: { pendingDispatch: 0, dispatched: 0, urgent: 0, issues: 0 } };
      },
      staleTime: 30000 // Cache for 30 seconds
    });
  }, [queryClient]);

  return { prefetchNextPage };
}

// Real-time updates via polling
export function useDispatchRealtimeUpdates(enabled: boolean = false, interval: number = 30000) {
  const queryClient = useQueryClient();

  const { data: realtimeData } = useQuery({
    queryKey: ['dispatch-realtime-updates'],
    queryFn: async () => {
      // Get recent dispatch updates
      const { data, error } = await supabase
        .from('charger_dispatches')
        .select('id, order_id, status, updated_at')
        .gte('updated_at', new Date(Date.now() - interval).toISOString())
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled,
    refetchInterval: interval,
    refetchIntervalInBackground: false
  });

  // Invalidate relevant queries when updates are detected
  const invalidateOnUpdates = useCallback(() => {
    if (realtimeData && realtimeData.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['charger-dispatch-data'] });
    }
  }, [realtimeData, queryClient]);

  return { realtimeData, invalidateOnUpdates };
}

// Optimized search with debouncing and caching
export function useOptimizedDispatchSearch() {
  const queryClient = useQueryClient();

  const searchOrders = useCallback(async (searchTerm: string, filters: any) => {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const cacheKey = ['dispatch-search', searchTerm, filters];
    
    // Check if we have cached results
    const cachedData = queryClient.getQueryData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Perform search with optimized query
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        clients!inner (
          full_name,
          postcode,
          address
        )
      `)
      .or(`order_number.ilike.%${searchTerm}%,clients.full_name.ilike.%${searchTerm}%,clients.postcode.ilike.%${searchTerm}%`)
      .not('scheduled_install_date', 'is', null)
      .limit(50);

    if (error) throw error;

    // Cache the results
    queryClient.setQueryData(cacheKey, data);
    
    // Set stale time separately  
    setTimeout(() => {
      queryClient.removeQueries({ queryKey: cacheKey });
    }, 60000);

    return data;
  }, [queryClient]);

  return { searchOrders };
}

// Memory management for large datasets
export function useDispatchMemoryManagement() {
  const queryClient = useQueryClient();

  const clearOldCaches = useCallback(() => {
    // Remove cached data older than 5 minutes
    const cutoffTime = Date.now() - 5 * 60 * 1000;
    
    queryClient.getQueryCache().getAll().forEach((query) => {
      if (query.queryKey[0] === 'charger-dispatch-data' && query.state.dataUpdatedAt < cutoffTime) {
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
  }, [queryClient]);

  const getMemoryStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const allQueries = cache.getAll();
    const dispatchQueries = allQueries.filter(q => 
      Array.isArray(q.queryKey) && q.queryKey[0] === 'charger-dispatch-data'
    );

    return {
      totalQueries: allQueries.length,
      dispatchQueries: dispatchQueries.length,
      cacheSize: dispatchQueries.reduce((acc, query) => {
        return acc + (query.state.data ? JSON.stringify(query.state.data).length : 0);
      }, 0)
    };
  }, [queryClient]);

  return { clearOldCaches, getMemoryStats };
}

// Performance monitoring hooks
export function useDispatchPerformanceMetrics() {
  const startTime = useMemo(() => Date.now(), []);

  const measureRenderTime = useCallback(() => {
    return Date.now() - startTime;
  }, [startTime]);

  const trackTableInteraction = useCallback((action: string, orderId?: string) => {
    const timestamp = Date.now();
    const performanceData = {
      action,
      orderId,
      timestamp,
      renderTime: measureRenderTime()
    };

    // Log performance data (in production, this would go to analytics)
    console.log('Dispatch Performance:', performanceData);

    return performanceData;
  }, [measureRenderTime]);

  return { measureRenderTime, trackTableInteraction };
}