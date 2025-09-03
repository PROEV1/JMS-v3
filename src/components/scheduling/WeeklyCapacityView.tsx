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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
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

        // Fetch scheduled jobs for this day
        const { data: scheduledOrders, error: ordersError } = await supabase
          .from('orders')
          .select('id')
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
                <Button variant="outline" size="sm" disabled={!selectedDate}>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {selectedDate ? (
                    isExpanded ? 'Hide Details' : `View ${format(new Date(selectedDate), 'EEE MMM d')}`
                  ) : 'Select a day'}
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
                onClick={() => {
                  setSelectedDate(day.date);
                  setIsExpanded(true);
                }}
                className={`
                  p-3 rounded-lg border text-center space-y-2 cursor-pointer transition-all hover:ring-2 hover:ring-primary/50
                  ${isWeekend ? 'bg-muted/50' : 'bg-background'}
                  ${isToday ? 'ring-2 ring-primary' : ''}
                  ${day.isAtRisk ? 'border-orange-300 bg-orange-50/50' : ''}
                  ${selectedDate === day.date ? 'ring-2 ring-primary bg-primary/5' : ''}
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
        
        {/* Expandable Engineer Breakdown - Per Day */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="space-y-4">
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Engineers with Spare Capacity</h4>
              <div className="space-y-4">
                {selectedDate && capacityData?.find(day => day.date === selectedDate) && (() => {
                  const day = capacityData.find(day => day.date === selectedDate)!;
                  // Get engineers with spare capacity for this day
                  const engineersWithSpareCapacity = day.engineerBreakdown
                    ?.filter(engineer => engineer.scheduledJobs < engineer.maxCapacity)
                    .sort((a, b) => (b.maxCapacity - b.scheduledJobs) - (a.maxCapacity - a.scheduledJobs)) || [];
                    
                  const isWeekend = new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6;
                  const isToday = day.date === format(new Date(), 'yyyy-MM-dd');
                  
                  if (engineersWithSpareCapacity.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">All engineers are at full capacity on {day.dayName}, {format(new Date(day.date), 'MMM d')}</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="border rounded-lg overflow-hidden">
                      <div className={`
                        px-4 py-2 border-b flex items-center justify-between
                        ${isWeekend ? 'bg-muted/30' : 'bg-background'}
                        ${isToday ? 'bg-primary/5 border-primary/20' : ''}
                      `}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {day.dayName}, {format(new Date(day.date), 'MMM d')}
                          </span>
                          {isToday && (
                            <Badge variant="outline" className="text-xs">Today</Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {engineersWithSpareCapacity.length} Available
                        </Badge>
                      </div>
                      
                      <div className="p-3 space-y-2">
                        {engineersWithSpareCapacity.map((engineer) => {
                          const remainingCapacity = engineer.maxCapacity - engineer.scheduledJobs;
                          const utilization = Math.round((engineer.scheduledJobs / engineer.maxCapacity) * 100);
                          
                          return (
                            <div key={engineer.engineerId} className="flex items-center justify-between py-2 px-3 rounded-lg border bg-background/50">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{engineer.engineerName}</span>
                                  <Badge 
                                    variant={remainingCapacity > 1 ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    +{remainingCapacity} slots
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">{engineer.engineerRegion}</span>
                              </div>
                              
                              <div className="flex items-center gap-3 min-w-0 flex-1 max-w-xs">
                                <div className="text-xs text-muted-foreground text-right">
                                  {engineer.scheduledJobs}/{engineer.maxCapacity}
                                </div>
                                <div className="flex-1">
                                  <Progress 
                                    value={utilization} 
                                    className="h-2" 
                                  />
                                </div>
                                <div className="text-xs font-medium text-right min-w-[3rem]">
                                  {utilization}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
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