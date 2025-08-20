import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';

interface DayCapacity {
  date: string;
  dayName: string;
  totalCapacity: number;
  scheduledInstalls: number;
  remainingCapacity: number;
  utilizationPercentage: number;
  isAtRisk: boolean;
}

export function WeeklyCapacityView() {
  const { data: capacityData, isLoading } = useQuery({
    queryKey: ['weekly-capacity'],
    queryFn: async () => {
      const today = startOfDay(new Date());
      const weekData: DayCapacity[] = [];

      // Get next 7 days
      for (let i = 0; i < 7; i++) {
        const targetDate = addDays(today, i);
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Fetch engineers and their availability for this day
        const { data: engineers, error: engineersError } = await supabase
          .from('engineers')
          .select(`
            id,
            name,
            availability,
            max_installs_per_day,
            engineer_availability(day_of_week, is_available),
            engineer_time_off(start_date, end_date, status)
          `)
          .eq('availability', true);

        if (engineersError) throw engineersError;

        // Calculate total capacity for this day
        let totalCapacity = 0;
        
        for (const engineer of engineers || []) {
          // Check if engineer is available on this day of week
          const dayAvailability = engineer.engineer_availability?.find(
            (avail: any) => avail.day_of_week === dayOfWeek && avail.is_available
          );
          
          // Check if engineer has approved time off on this date
          const hasTimeOff = engineer.engineer_time_off?.some((timeOff: any) => {
            const startDate = new Date(timeOff.start_date);
            const endDate = new Date(timeOff.end_date);
            return timeOff.status === 'approved' && 
                   targetDate >= startDate && 
                   targetDate <= endDate;
          });

          // If engineer is available for this day and not on time off, add their capacity
          if (dayAvailability && !hasTimeOff) {
            totalCapacity += engineer.max_installs_per_day || 2;
          }
        }

        // Fetch scheduled installations for this day
        const { data: scheduledOrders, error: ordersError } = await supabase
          .from('orders')
          .select('id')
          .eq('job_type', 'installation')
          .gte('scheduled_install_date', dateStr)
          .lt('scheduled_install_date', format(addDays(targetDate, 1), 'yyyy-MM-dd'))
          .not('status_enhanced', 'in', '(completed)');

        if (ordersError) throw ordersError;

        const scheduledInstalls = scheduledOrders?.length || 0;
        const remainingCapacity = Math.max(0, totalCapacity - scheduledInstalls);
        const utilizationPercentage = totalCapacity > 0 ? Math.round((scheduledInstalls / totalCapacity) * 100) : 0;
        const isAtRisk = remainingCapacity > 0 && remainingCapacity <= totalCapacity * 0.2; // At risk if ≤20% capacity remaining

        weekData.push({
          date: dateStr,
          dayName: format(targetDate, 'EEE'),
          totalCapacity,
          scheduledInstalls,
          remainingCapacity,
          utilizationPercentage,
          isAtRisk
        });
      }

      return weekData;
    },
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            7-Day Installation Capacity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalWeekCapacity = capacityData?.reduce((sum, day) => sum + day.totalCapacity, 0) || 0;
  const totalWeekScheduled = capacityData?.reduce((sum, day) => sum + day.scheduledInstalls, 0) || 0;
  const atRiskDays = capacityData?.filter(day => day.isAtRisk).length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            7-Day Installation Capacity
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              {totalWeekScheduled}/{totalWeekCapacity} Weekly
            </Badge>
            {atRiskDays > 0 && (
              <Badge variant="destructive" className="text-xs">
                {atRiskDays} At Risk
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {capacityData?.map((day, index) => (
          <div key={day.date} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium w-8">
                  {day.dayName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(day.date), 'MMM d')}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {day.scheduledInstalls}/{day.totalCapacity}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {day.remainingCapacity} remaining
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {day.isAtRisk ? (
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                  ) : day.utilizationPercentage > 80 ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : (
                    <Users className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Progress 
                value={day.utilizationPercentage} 
                className="flex-1 h-2" 
              />
              <div className="text-xs text-muted-foreground w-12 text-right">
                {day.utilizationPercentage}%
              </div>
            </div>
            
            {day.isAtRisk && (
              <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                ⚠️ Limited capacity - may waste engineer time
              </div>
            )}
          </div>
        ))}
        
        <div className="pt-2 mt-4 border-t text-xs text-muted-foreground">
          💡 Capacity based on available engineers × max installs per day
        </div>
      </CardContent>
    </Card>
  );
}