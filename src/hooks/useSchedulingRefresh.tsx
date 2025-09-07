import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Centralized hook for managing scheduling-related data refreshes
 * Provides debounced refresh with proper query invalidation sequence
 */
export function useSchedulingRefresh() {
  const queryClient = useQueryClient();

  const refreshSchedulingData = useCallback(async () => {
    console.log('🔄 Starting centralized scheduling refresh...');
    
    try {
      // Invalidate all scheduling-related queries in the correct order
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['job-offers'] }),
        queryClient.invalidateQueries({ queryKey: ['schedule-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['engineers'] })
      ]);
      
      console.log('✅ Centralized scheduling refresh completed');
    } catch (error) {
      console.error('❌ Error during centralized refresh:', error);
    }
  }, [queryClient]);

  // Debounced refresh function to prevent excessive refetches
  const debouncedRefresh = useCallback(() => {
    const timeoutId = setTimeout(refreshSchedulingData, 100);
    return () => clearTimeout(timeoutId);
  }, [refreshSchedulingData]);

  return {
    refreshSchedulingData,
    debouncedRefresh
  };
}