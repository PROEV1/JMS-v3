import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Truck, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { useChargerDispatchData } from '@/hooks/useChargerDispatchData';
import { useNavigate } from 'react-router-dom';

export function DispatchKpiTiles() {
  const navigate = useNavigate();
  
  // Get current week's data for KPIs
  const { data, isLoading } = useChargerDispatchData({
    pagination: { page: 1, pageSize: 1000, offset: 0 },
    filters: {
      dateFrom: new Date().toISOString().split('T')[0],
      dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      region: 'all',
      engineer: 'all',
      dispatchStatus: 'all',
      jobType: 'all'
    }
  });

  const stats = data?.stats || {
    pendingDispatch: 0,
    dispatched: 0,
    urgent: 0,
    issues: 0
  };

  const handleKpiClick = (filter: string) => {
    const params = new URLSearchParams({
      dispatchStatus: filter,
      dateFrom: new Date().toISOString().split('T')[0],
      dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    navigate(`/admin/dispatch?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* This Week's Jobs */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data?.totalCount || 0}</div>
          <p className="text-xs text-muted-foreground">
            Scheduled installations
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 p-0 h-auto text-xs"
            onClick={() => handleKpiClick('all')}
          >
            View all <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Urgent Dispatches */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow border-red-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Urgent Dispatch</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
          <p className="text-xs text-muted-foreground">
            Due within 48h
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 p-0 h-auto text-xs text-red-600"
            onClick={() => handleKpiClick('pending_dispatch')}
          >
            Action needed <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Pending Dispatch */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow border-orange-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Not Dispatched</CardTitle>
          <Package className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{stats.pendingDispatch}</div>
          <p className="text-xs text-muted-foreground">
            Awaiting dispatch
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 p-0 h-auto text-xs text-orange-600"
            onClick={() => handleKpiClick('pending_dispatch')}
          >
            Review queue <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Successfully Dispatched */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow border-green-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Dispatched</CardTitle>
          <Truck className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.dispatched}</div>
          <p className="text-xs text-muted-foreground">
            In transit this week
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 p-0 h-auto text-xs text-green-600"
            onClick={() => handleKpiClick('dispatched')}
          >
            Track shipments <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}