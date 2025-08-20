import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, TrendingUp, TrendingDown, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';

interface DayCapacity {
  date: string;
  dayName: string;
  totalCapacity: number;
  scheduledInstalls: number;
  remainingCapacity: number;
  utilizationPercentage: number;
  isAtRisk: boolean;
  engineerBreakdown?: Array<{
    engineerId: string;
    engineerName: string;
    engineerRegion: string;
    scheduledJobs: number;
    maxCapacity: number;
  }>;
}

export function WeeklyCapacityView() {
  const [isExpanded, setIsExpanded] = useState(false);
  
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
            region,
            availability,
            max_installs_per_day,
            engineer_availability(day_of_week, is_available),
            engineer_time_off(start_date, end_date, status)
          `)
          .eq('availability', true);

        if (engineersError) throw engineersError;

        // Calculate total capacity for this day
        let totalCapacity = 0;
        const engineerBreakdown: Array<{
          engineerId: string;
          engineerName: string;
          engineerRegion: string;
          scheduledJobs: number;
          maxCapacity: number;
        }> = [];
        
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
            const maxCapacity = engineer.max_installs_per_day || 2;
            totalCapacity += maxCapacity;
            
            // Get scheduled jobs for this engineer on this day
            const { data: scheduledJobs } = await supabase
              .from('orders')
              .select('id')
              .eq('job_type', 'installation')
              .eq('engineer_id', engineer.id)
              .gte('scheduled_install_date', dateStr)
              .lt('scheduled_install_date', format(addDays(targetDate, 1), 'yyyy-MM-dd'))
              .not('status_enhanced', 'in', '(completed)');

            engineerBreakdown.push({
              engineerId: engineer.id,
              engineerName: engineer.name,
              engineerRegion: engineer.region || 'Unknown',
              scheduledJobs: scheduledJobs?.length || 0,
              maxCapacity
            });
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
          isAtRisk,
          engineerBreakdown
        });
      }

      return weekData;
    },
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card className="w-full">
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
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            7-Day Installation Capacity
          </CardTitle>
          <div className="flex items-center gap-3">
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
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {isExpanded ? 'Less Detail' : 'More Detail'}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily Overview Grid */}
        <div className="grid grid-cols-7 gap-3">
          {capacityData?.map((day) => {
            const isWeekend = new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6;
            const isToday = day.date === format(new Date(), 'yyyy-MM-dd');
            
            return (
              <div 
                key={day.date} 
                className={`
                  p-3 rounded-lg border text-center space-y-2
                  ${isWeekend ? 'bg-muted/50' : 'bg-background'}
                  ${isToday ? 'ring-2 ring-primary' : ''}
                  ${day.isAtRisk ? 'border-orange-300 bg-orange-50/50' : ''}
                `}
              >
                <div className="text-sm font-medium">
                  {day.dayName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(day.date), 'MMM d')}
                </div>
                
                <div className="space-y-1">
                  <div className="text-lg font-bold">{day.scheduledInstalls}</div>
                  <div className="text-xs text-muted-foreground">
                    of {day.totalCapacity} slots
                  </div>
                  
                  <Badge 
                    variant={day.utilizationPercentage > 90 ? 'destructive' : day.utilizationPercentage > 70 ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {day.utilizationPercentage}%
                  </Badge>
                  
                  {day.remainingCapacity > 0 && (
                    <div className="text-xs text-green-600 font-medium">
                      +{day.remainingCapacity} available
                    </div>
                  )}
                  
                  {day.isAtRisk && (
                    <div className="flex items-center justify-center">
                      <TrendingDown className="h-3 w-3 text-orange-500" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Expandable Engineer Breakdown */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="space-y-4">
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Engineer Breakdown</h4>
              <div className="space-y-3">
                {capacityData?.flatMap(day => day.engineerBreakdown || [])
                  .reduce((uniqueEngineers, engineer) => {
                    if (!uniqueEngineers.find(e => e.engineerId === engineer.engineerId)) {
                      uniqueEngineers.push(engineer);
                    }
                    return uniqueEngineers;
                  }, [] as any[])
                  .map((engineer) => {
                    const weeklyScheduled = capacityData?.reduce((total, day) => {
                      const engineerData = day.engineerBreakdown?.find(e => e.engineerId === engineer.engineerId);
                      return total + (engineerData?.scheduledJobs || 0);
                    }, 0) || 0;
                    
                    const weeklyCapacity = engineer.maxCapacity * 7;
                    const weeklyUtilization = Math.round((weeklyScheduled / weeklyCapacity) * 100);
                    
                    return (
                      <div key={engineer.engineerId} className="flex items-center justify-between p-3 rounded border bg-background">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{engineer.engineerName}</span>
                          <span className="text-xs text-muted-foreground">{engineer.engineerRegion}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm">
                            {weeklyScheduled}/{weeklyCapacity} weekly slots
                          </div>
                          <Badge 
                            variant={weeklyUtilization > 90 ? 'destructive' : weeklyUtilization > 70 ? 'secondary' : 'default'}
                            className="text-xs"
                          >
                            {weeklyUtilization}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        {/* Summary */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{totalWeekCapacity}</div>
              <div className="text-sm text-muted-foreground">Total Capacity</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{totalWeekScheduled}</div>
              <div className="text-sm text-muted-foreground">Scheduled</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{totalWeekCapacity - totalWeekScheduled}</div>
              <div className="text-sm text-muted-foreground">Available</div>
            </div>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground text-center">
          💡 Capacity based on available engineers × max installs per day
        </div>
      </CardContent>
    </Card>
  );
}