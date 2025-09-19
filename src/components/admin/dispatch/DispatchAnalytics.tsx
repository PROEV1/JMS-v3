import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Download,
  Calendar
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DispatchAnalyticsProps {
  dateRange: { from: string; to: string };
  className?: string;
}

export function DispatchAnalytics({ dateRange, className }: DispatchAnalyticsProps) {
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['dispatch-analytics', dateRange],
    queryFn: async () => {
      // Get dispatch data for analytics
      const { data: dispatches, error } = await supabase
        .from('charger_dispatches')
        .select(`
          id,
          status,
          created_at,
          dispatched_at,
          delivered_at,
          orders!inner (
            scheduled_install_date,
            job_type,
            engineers (
              region
            )
          )
        `)
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to);

      if (error) throw error;

      // Calculate metrics
      const totalDispatches = dispatches.length;
      const dispatchedCount = dispatches.filter(d => d.status === 'dispatched').length;
      const deliveredCount = dispatches.filter(d => d.status === 'delivered').length;
      const issuesCount = dispatches.filter(d => d.status === 'issue').length;

      // Calculate average dispatch time (from order to dispatch)
      const avgDispatchTime = dispatches
        .filter(d => d.dispatched_at)
        .reduce((acc, d) => {
          const orderDate = new Date(d.created_at);
          const dispatchDate = new Date(d.dispatched_at!);
          return acc + (dispatchDate.getTime() - orderDate.getTime());
        }, 0) / dispatchedCount / (1000 * 60 * 60 * 24); // Convert to days

      // SLA compliance (dispatched within 3 days)
      const slaCompliant = dispatches.filter(d => {
        if (!d.dispatched_at) return false;
        const orderDate = new Date(d.created_at);
        const dispatchDate = new Date(d.dispatched_at);
        const daysDiff = (dispatchDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 3;
      }).length;

      const slaComplianceRate = totalDispatches > 0 ? (slaCompliant / totalDispatches) * 100 : 0;

      // Group by status for pie chart
      const statusData = [
        { name: 'Dispatched', value: dispatchedCount, color: '#10b981' },
        { name: 'Delivered', value: deliveredCount, color: '#3b82f6' },
        { name: 'Issues', value: issuesCount, color: '#ef4444' },
        { name: 'Pending', value: totalDispatches - dispatchedCount - deliveredCount - issuesCount, color: '#f59e0b' }
      ];

      // Group by region
      const regionStats = dispatches.reduce((acc, d) => {
        const region = d.orders?.engineers?.region || 'Unknown';
        acc[region] = (acc[region] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const regionData = Object.entries(regionStats).map(([region, count]) => ({
        region,
        count
      }));

      // Weekly trend data
      const weeklyData = [];
      const startDate = new Date(dateRange.from);
      const endDate = new Date(dateRange.to);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
        const weekEnd = new Date(d);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const weekDispatches = dispatches.filter(dispatch => {
          const dispatchDate = new Date(dispatch.created_at);
          return dispatchDate >= d && dispatchDate <= weekEnd;
        });

        weeklyData.push({
          week: `${d.getMonth() + 1}/${d.getDate()}`,
          dispatches: weekDispatches.length,
          issues: weekDispatches.filter(d => d.status === 'issue').length
        });
      }

      return {
        totalDispatches,
        dispatchedCount,
        deliveredCount,
        issuesCount,
        avgDispatchTime,
        slaComplianceRate,
        statusData,
        regionData,
        weeklyData
      };
    }
  });

  const exportAnalytics = () => {
    if (!analyticsData) return;

    const csvContent = [
      ['Metric', 'Value'],
      ['Total Dispatches', analyticsData.totalDispatches],
      ['Dispatched', analyticsData.dispatchedCount],
      ['Delivered', analyticsData.deliveredCount],
      ['Issues', analyticsData.issuesCount],
      ['Average Dispatch Time (days)', analyticsData.avgDispatchTime.toFixed(2)],
      ['SLA Compliance Rate (%)', analyticsData.slaComplianceRate.toFixed(2)]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispatch-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analyticsData) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Dispatches</p>
                <p className="text-2xl font-bold">{analyticsData.totalDispatches}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Dispatch Time</p>
                <p className="text-2xl font-bold">{analyticsData.avgDispatchTime.toFixed(1)}d</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">SLA Compliance</p>
                <p className="text-2xl font-bold">{analyticsData.slaComplianceRate.toFixed(1)}%</p>
              </div>
              <CheckCircle className={`h-8 w-8 ${analyticsData.slaComplianceRate >= 80 ? 'text-green-500' : 'text-yellow-500'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Issues</p>
                <p className="text-2xl font-bold">{analyticsData.issuesCount}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${analyticsData.issuesCount > 0 ? 'text-red-500' : 'text-green-500'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Dispatch Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {analyticsData.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Regional Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Dispatches by Region</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.regionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Weekly Dispatch Trend</CardTitle>
          <Button onClick={exportAnalytics} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Analytics
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="dispatches" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="issues" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* SLA Performance */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Dispatch within 3 days</span>
            <Badge variant={analyticsData.slaComplianceRate >= 80 ? "default" : "destructive"}>
              {analyticsData.slaComplianceRate.toFixed(1)}%
            </Badge>
          </div>
          <Progress value={analyticsData.slaComplianceRate} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Target: 80% compliance rate
          </p>
        </CardContent>
      </Card>
    </div>
  );
}