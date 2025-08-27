import { supabase } from '@/integrations/supabase/client';

export interface MapboxUsageStats {
  geocodingCalls: number;
  directionsCalls: number;
  matrixCalls: number;
  cacheHits: number;
  totalCalls: number;
  cacheHitRate: number;
}

export interface MapboxUsageSummary {
  today: MapboxUsageStats;
  thisWeek: MapboxUsageStats;
  thisMonth: MapboxUsageStats;
}

/**
 * Get Mapbox usage statistics for different time periods
 */
export async function getMapboxUsageStats(): Promise<MapboxUsageSummary> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // Get usage data for different periods
    const [todayData, weekData, monthData] = await Promise.all([
      getUsageForPeriod(today, now),
      getUsageForPeriod(weekAgo, now),
      getUsageForPeriod(monthAgo, now)
    ]);

    return {
      today: todayData,
      thisWeek: weekData,
      thisMonth: monthData
    };
  } catch (error) {
    console.error('Error getting Mapbox usage stats:', error);
    const emptyStats: MapboxUsageStats = {
      geocodingCalls: 0,
      directionsCalls: 0,
      matrixCalls: 0,
      cacheHits: 0,
      totalCalls: 0,
      cacheHitRate: 0
    };
    return {
      today: emptyStats,
      thisWeek: emptyStats,
      thisMonth: emptyStats
    };
  }
}

/**
 * Get usage statistics for a specific time period
 */
async function getUsageForPeriod(startDate: Date, endDate: Date): Promise<MapboxUsageStats> {
  const { data, error } = await supabase
    .from('mapbox_usage_tracking')
    .select('api_type, call_count, metadata')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error) {
    console.error('Error fetching usage data:', error);
    return {
      geocodingCalls: 0,
      directionsCalls: 0,
      matrixCalls: 0,
      cacheHits: 0,
      totalCalls: 0,
      cacheHitRate: 0
    };
  }

  const stats = {
    geocodingCalls: 0,
    directionsCalls: 0,
    matrixCalls: 0,
    cacheHits: 0,
    totalCalls: 0,
    cacheHitRate: 0
  };

  data?.forEach(record => {
    const callCount = record.call_count || 0;
    stats.totalCalls += callCount;

    switch (record.api_type) {
      case 'geocoding':
        stats.geocodingCalls += callCount;
        // Extract cache hits from metadata
        if (record.metadata && typeof record.metadata === 'object' && 'cache_hits' in record.metadata) {
          stats.cacheHits += (record.metadata as any).cache_hits || 0;
        }
        break;
      case 'directions':
        stats.directionsCalls += callCount;
        break;
      case 'matrix':
        stats.matrixCalls += callCount;
        break;
    }
  });

  // Calculate cache hit rate
  if (stats.geocodingCalls + stats.cacheHits > 0) {
    stats.cacheHitRate = Math.round((stats.cacheHits / (stats.geocodingCalls + stats.cacheHits)) * 100);
  }

  return stats;
}

/**
 * Get geocode cache statistics
 */
export async function getGeocodeCacheStats(): Promise<{
  totalEntries: number;
  hitCount: number;
  averageAge: number;
}> {
  try {
    const { data, error } = await supabase
      .from('geocode_cache')
      .select('hit_count, created_at, last_accessed')
      .gte('expires_at', new Date().toISOString()); // Only non-expired entries

    if (error) {
      console.error('Error fetching geocode cache stats:', error);
      return { totalEntries: 0, hitCount: 0, averageAge: 0 };
    }

    const totalEntries = data?.length || 0;
    const totalHits = data?.reduce((sum, entry) => sum + (entry.hit_count || 0), 0) || 0;
    
    // Calculate average age in hours
    const now = new Date().getTime();
    const totalAge = data?.reduce((sum, entry) => {
      const created = new Date(entry.created_at).getTime();
      return sum + (now - created);
    }, 0) || 0;
    
    const averageAgeHours = totalEntries > 0 ? Math.round(totalAge / totalEntries / (1000 * 60 * 60)) : 0;

    return {
      totalEntries,
      hitCount: totalHits,
      averageAge: averageAgeHours
    };
  } catch (error) {
    console.error('Error getting geocode cache stats:', error);
    return { totalEntries: 0, hitCount: 0, averageAge: 0 };
  }
}