import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function WeekAtAGlance() {
  const navigate = useNavigate();

  // Get this week's dates
  const getWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay + 1); // Start on Monday
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  const weekDates = getWeekDates();

  // Fetch scheduled jobs for this week
  const { data: weeklyJobs, isLoading } = useQuery({
    queryKey: ['weekly-schedule', weekDates[0].toISOString().split('T')[0], weekDates[6].toISOString().split('T')[0]],
    queryFn: async () => {
      const startDate = weekDates[0].toISOString().split('T')[0];
      const endDate = weekDates[6].toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          scheduled_install_date,
          status_enhanced,
          engineer:engineers(name),
          client:clients(full_name)
        `)
        .eq('status_enhanced', 'scheduled')
        .gte('scheduled_install_date', startDate)
        .lte('scheduled_install_date', endDate);

      if (error) throw error;

      // Group by date
      const groupedJobs: Record<string, any[]> = {};
      data?.forEach(job => {
        const dateKey = job.scheduled_install_date?.split('T')[0];
        if (dateKey) {
          if (!groupedJobs[dateKey]) groupedJobs[dateKey] = [];
          groupedJobs[dateKey].push(job);
        }
      });

      return groupedJobs;
    }
  });

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getDayNumber = (date: Date) => {
    return date.getDate();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getJobsForDate = (date: Date) => {
    const dateKey = date.toISOString().split('T')[0];
    return weeklyJobs?.[dateKey] || [];
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Week at a Glance
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin/schedule?tab=calendar')}
          >
            <Eye className="h-4 w-4 mr-1" />
            Full View
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          weekDates.map((date, index) => {
            const jobs = getJobsForDate(date);
            const dayName = getDayName(date);
            const dayNumber = getDayNumber(date);
            const today = isToday(date);

            return (
              <div 
                key={index} 
                className={`
                  flex items-center justify-between p-2 rounded-lg border
                  ${today ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border'}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    text-center min-w-[40px]
                    ${today ? 'text-primary font-bold' : 'text-muted-foreground'}
                  `}>
                    <div className="text-xs font-medium">{dayName}</div>
                    <div className="text-sm">{dayNumber}</div>
                  </div>
                  <div className="flex-1">
                    {jobs.length > 0 ? (
                      <div className="space-y-1">
                        {jobs.slice(0, 2).map((job, jobIndex) => (
                          <div key={jobIndex} className="text-xs text-muted-foreground">
                            {job.engineer?.name} - {job.client?.full_name}
                          </div>
                        ))}
                        {jobs.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{jobs.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No jobs scheduled</div>
                    )}
                  </div>
                </div>
                <div>
                  {jobs.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {jobs.length}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}