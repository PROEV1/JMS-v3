import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { SchedulePipelineDashboard } from './SchedulePipelineDashboard';
import { KpiCard } from './KpiCard';
import { AlertsPanel } from './AlertsPanel';
import { WeekAtAGlance } from './WeekAtAGlance';
import { RecentActivity } from './RecentActivity';
import { 
  Calendar, 
  Zap, 
  RefreshCw, 
  Eye,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users
} from 'lucide-react';

interface SchedulingHubProps {}

export function SchedulingHub({}: SchedulingHubProps) {
  const navigate = useNavigate();
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');

  // Fetch scheduling KPIs
  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['scheduling-kpis', regionFilter, dateFilter],
    queryFn: async () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);

      const [
        unassignedResult,
        pendingOffersResult,
        expiringOffersResult,
        scheduledTodayResult,
        unavailableEngineersResult
      ] = await Promise.all([
        // Unassigned jobs (awaiting_install_booking)
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'awaiting_install_booking')
          .is('engineer_id', null),
        
        // Pending offers
        supabase
          .from('job_offers')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .gt('expires_at', now.toISOString()),
        
        // Expiring offers (within 24 hours)
        supabase
          .from('job_offers')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .gt('expires_at', now.toISOString())
          .lt('expires_at', tomorrow.toISOString()),
        
        // Scheduled for today
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'scheduled')
          .gte('scheduled_install_date', now.toISOString().split('T')[0])
          .lt('scheduled_install_date', tomorrow.toISOString().split('T')[0]),
        
        // Unavailable engineers (simplified count)
        supabase
          .from('engineers')
          .select('*', { count: 'exact', head: true })
          .eq('availability', false)
      ]);

      return {
        unassigned: unassignedResult.count || 0,
        pendingOffers: pendingOffersResult.count || 0,
        expiringOffers: expiringOffersResult.count || 0,
        scheduledToday: scheduledTodayResult.count || 0,
        unavailableEngineers: unavailableEngineersResult.count || 0
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch orders for pipeline dashboard
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['scheduling-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(full_name, email, postcode),
          engineer:engineers(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const handleRefresh = () => {
    refetchKpis();
  };

  const handleAutoSchedule = () => {
    navigate('/admin/schedule/status/needs-scheduling');
  };

  const handleSmartAssignment = () => {
    navigate('/admin/schedule/status/needs-scheduling');
  };

  const handleWeekView = () => {
    navigate('/admin/schedule', { state: { tab: 'calendar' } });
  };

  if (kpiLoading || ordersLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduling Hub</h1>
          <p className="text-muted-foreground">Your central command for job scheduling and workflow management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KpiCard
          title="Unassigned Jobs"
          value={kpiData?.unassigned || 0}
          icon={Clock}
          variant="warning"
          onClick={() => navigate('/admin/schedule/status/needs-scheduling')}
        />
        <KpiCard
          title="Pending Offers"
          value={kpiData?.pendingOffers || 0}
          icon={CheckCircle}
          variant="info"
          onClick={() => navigate('/admin/schedule/status/date-offered')}
        />
        <KpiCard
          title="Expiring Soon"
          value={kpiData?.expiringOffers || 0}
          icon={AlertTriangle}
          variant="danger"
          onClick={() => navigate('/admin/schedule/status/date-offered')}
        />
        <KpiCard
          title="Scheduled Today"
          value={kpiData?.scheduledToday || 0}
          icon={Calendar}
          variant="success"
        />
        <KpiCard
          title="Unavailable Engineers"
          value={kpiData?.unavailableEngineers || 0}
          icon={Users}
          variant="neutral"
        />
      </div>

      {/* Alerts Panel */}
      <AlertsPanel 
        expiringOffers={kpiData?.expiringOffers || 0}
        unassignedJobs={kpiData?.unassigned || 0}
      />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleAutoSchedule} variant="default">
              <Zap className="h-4 w-4 mr-2" />
              Auto-Schedule Available Jobs
            </Button>
            <Button onClick={handleSmartAssignment} variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Smart Engineer Assignment
            </Button>
            <Button onClick={handleWeekView} variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              Week View Calendar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pipeline Dashboard */}
        <div className="lg:col-span-2">
          <SchedulePipelineDashboard orders={orders} />
        </div>

        {/* Right: Week at a Glance + Recent Activity */}
        <div className="space-y-6">
          <WeekAtAGlance />
          <RecentActivity />
        </div>
      </div>

      {/* Filters (Hidden for now but structure ready) */}
      <div className="hidden">
        <div className="flex items-center gap-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="north">North</SelectItem>
              <SelectItem value="south">South</SelectItem>
              <SelectItem value="east">East</SelectItem>
              <SelectItem value="west">West</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Today" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}