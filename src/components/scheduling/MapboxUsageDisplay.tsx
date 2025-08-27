import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, BarChart3, MapPin, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MapboxUsageMetrics {
  geocoding: number;
  directions: number;
  matrix: number;
  total: number;
  sessions: number;
}

interface MapboxUsageDisplayProps {
  sessionId?: string;
  showDetailed?: boolean;
  refreshInterval?: number; // seconds
}

export function MapboxUsageDisplay({ 
  sessionId, 
  showDetailed = false, 
  refreshInterval = 30 
}: MapboxUsageDisplayProps) {
  const [metrics, setMetrics] = useState<MapboxUsageMetrics>({
    geocoding: 0,
    directions: 0,
    matrix: 0,
    total: 0,
    sessions: 0
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('mapbox_usage_tracking')
        .select('api_type, call_count, session_id')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const sessionSet = new Set();
      const totals = data.reduce((acc, record) => {
        acc[record.api_type] = (acc[record.api_type] || 0) + record.call_count;
        if (record.session_id) {
          sessionSet.add(record.session_id);
        }
        return acc;
      }, { geocoding: 0, directions: 0, matrix: 0 });

      const newMetrics = {
        geocoding: totals.geocoding || 0,
        directions: totals.directions || 0,
        matrix: totals.matrix || 0,
        total: (totals.geocoding || 0) + (totals.directions || 0) + (totals.matrix || 0),
        sessions: sessionSet.size
      };

      setMetrics(newMetrics);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch Mapbox usage metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchMetrics, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [sessionId, refreshInterval]);

  const getUsageLevel = (total: number): { color: string; label: string } => {
    if (total === 0) return { color: 'secondary', label: 'No Usage' };
    if (total < 50) return { color: 'success', label: 'Low' };
    if (total < 200) return { color: 'warning', label: 'Moderate' };
    return { color: 'destructive', label: 'High' };
  };

  const usageLevel = getUsageLevel(metrics.total);

  if (!showDetailed && metrics.total === 0) {
    return null; // Don't show if no usage and not detailed view
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Mapbox API Usage
          {sessionId && (
            <Badge variant="outline" className="text-xs">
              Session
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={usageLevel.color as any}>
            {usageLevel.label}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total Calls</span>
          <span className="text-lg font-bold">{metrics.total.toLocaleString()}</span>
        </div>

        {showDetailed && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex flex-col items-center p-2 rounded bg-muted/30">
                <BarChart3 className="h-3 w-3 mb-1 text-blue-500" />
                <span className="font-medium">{metrics.geocoding}</span>
                <span className="text-muted-foreground">Geocoding</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded bg-muted/30">
                <Activity className="h-3 w-3 mb-1 text-green-500" />
                <span className="font-medium">{metrics.directions}</span>
                <span className="text-muted-foreground">Directions</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded bg-muted/30">
                <MapPin className="h-3 w-3 mb-1 text-purple-500" />  
                <span className="font-medium">{metrics.matrix}</span>
                <span className="text-muted-foreground">Matrix</span>
              </div>
            </div>

            {metrics.sessions > 0 && (
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Active Sessions</span>
                <span>{metrics.sessions}</span>
              </div>
            )}
          </div>
        )}

        {lastUpdated && (
          <div className="text-xs text-muted-foreground text-center">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        {!sessionId && metrics.total > 100 && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ High API usage detected. Consider optimizing queries or caching.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for inline display
 */
export function MapboxUsageBadge({ sessionId }: { sessionId?: string }) {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchTotal = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('mapbox_usage_tracking')
        .select('call_count')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalCalls = data.reduce((sum, record) => sum + record.call_count, 0);
      setTotal(totalCalls);
    } catch (error) {
      console.error('Failed to fetch usage total:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTotal();
  }, [sessionId]);

  if (total === 0 && !loading) return null;

  const variant = total < 50 ? 'secondary' : total < 200 ? 'warning' : 'destructive';

  return (
    <Badge variant={variant as any} className="gap-1">
      <MapPin className="h-3 w-3" />
      {loading ? '...' : total.toLocaleString()}
    </Badge>
  );
}