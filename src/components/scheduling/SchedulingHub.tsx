import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { WeekViewCalendar } from './WeekViewCalendar';
import { KpiCard } from './KpiCard';
import { AlertsPanel } from './AlertsPanel';
import { WeekAtAGlance } from './WeekAtAGlance';
import { RecentActivity } from './RecentActivity';
import { WeeklyCapacityView } from './WeeklyCapacityView';
import { EngineerLowStockPanel } from './EngineerLowStockPanel';
import { useScheduleStatusCounts } from '@/hooks/useScheduleStatusCounts';
import { 
  Calendar, 
  Zap, 
  RefreshCw, 
  Eye,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  BookOpen
} from 'lucide-react';

interface SchedulingHubProps {}

export function SchedulingHub({}: SchedulingHubProps) {
  const navigate = useNavigate();
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');

  // Use shared status counts hook
  const { counts, loading: statusLoading, refetch: refetchStatusCounts } = useScheduleStatusCounts();

  // Fetch orders and engineers for calendar
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders-for-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(full_name, email, postcode),
          engineer:engineers(name, email)
        `)
        .eq('job_type', 'installation')
        .not('scheduled_install_date', 'is', null)
        .order('scheduled_install_date', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  const { data: engineers = [], isLoading: engineersLoading } = useQuery({
    queryKey: ['engineers-for-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('availability', true)
        .order('name');

      if (error) throw error;
      return data || [];
    }
  });

  const handleRefresh = () => {
    refetchStatusCounts();
  };

  const handleAutoSchedule = () => {
    navigate('/admin/schedule/status/needs-scheduling');
  };

  const handleSmartAssignment = () => {
    navigate('/admin/schedule/status/needs-scheduling');
  };

  const handleWeekView = () => {
    navigate('/admin/schedule', { state: { tab: 'week-view' } });
  };

  if (statusLoading || ordersLoading || engineersLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-sm">
          <h1 className="brand-heading-1">Scheduling Hub</h1>
          <p className="brand-small text-muted-foreground">Your central command for job scheduling and workflow management</p>
        </div>
        <div className="flex gap-sm">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="icon-sm mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-md">
        <KpiCard
          title="Needs Scheduling"
          value={counts.needsScheduling}
          icon={Clock}
          variant="warning"
          onClick={() => navigate('/admin/schedule/status/needs-scheduling')}
        />
        <KpiCard
          title="Pending Offers"
          value={counts.dateOffered}
          icon={CheckCircle}
          variant="info"
          onClick={() => navigate('/admin/schedule/status/date-offered')}
        />
        <KpiCard
          title="Ready to Book"
          value={counts.readyToBook}
          icon={BookOpen}
          variant="success"
          onClick={() => navigate('/admin/schedule/status/ready-to-book')}
        />
        <KpiCard
          title="Scheduled Today"
          value={counts.scheduledToday}
          icon={Calendar}
          variant="success"
        />
        <KpiCard
          title="Unavailable Engineers"
          value={counts.unavailableEngineers}
          icon={Users}
          variant="neutral"
        />
      </div>

      {/* Alerts Panel */}
      <AlertsPanel 
        expiringOffers={0} // Expiring offers now handled separately in alerts logic
        unassignedJobs={counts.needsScheduling}
      />

      {/* Quick Actions */}
      <Card className="brand-card">
        <CardHeader className="pb-md">
          <CardTitle className="flex items-center gap-sm text-lg font-semibold">
            <Zap className="icon-md" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-md">
            <Button onClick={handleAutoSchedule} variant="default" className="h-10">
              <Zap className="icon-sm mr-2" />
              Auto-Schedule Available Jobs
            </Button>
            <Button onClick={handleSmartAssignment} variant="outline" className="h-10">
              <Users className="icon-sm mr-2" />
              Smart Engineer Assignment
            </Button>
            <Button onClick={handleWeekView} variant="outline" className="h-10">
              <Eye className="icon-sm mr-2" />
              Week View Calendar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Engineer Low Stock Status */}
      <EngineerLowStockPanel />

      {/* Full Width Capacity View */}
      <WeeklyCapacityView />

      {/* Full Width Engineer Week View */}
      <div className="w-full">
        <WeekViewCalendar 
          orders={orders} 
          engineers={engineers}
          onOrderClick={(order) => navigate(`/orders/${order.id}`)}
          currentDate={new Date()}
          onDateChange={() => {}}
        />
      </div>

      {/* Week at a Glance + Recent Activity Below */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <WeekAtAGlance />
        <RecentActivity />
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