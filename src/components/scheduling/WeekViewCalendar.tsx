import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Order, Engineer, getStatusColor, getOrderEstimatedHours } from '@/utils/schedulingUtils';
import { ChevronLeft, ChevronRight, User, AlertTriangle, Clock, MapPin, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface WeekViewCalendarProps {
  orders: Order[];
  engineers: Engineer[];
  onOrderClick: (order: Order) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export function WeekViewCalendar({
  orders,
  engineers,
  onOrderClick,
  currentDate,
  onDateChange
}: WeekViewCalendarProps) {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(currentDate));
  const [showOfferHolds, setShowOfferHolds] = useState<boolean>(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch active job offers for the current week
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const { data: jobOffers = [] } = useQuery({
    queryKey: ['job-offers', weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_offers')
        .select(`
          *,
          order:orders!job_offers_order_id_fkey(
            id,
            order_number,
            scheduled_install_date,
            client:clients(full_name)
          )
        `)
        .gte('offered_date', weekStart.toISOString().split('T')[0])
        .lte('offered_date', weekEnd.toISOString().split('T')[0])
        .or(
          'and(status.eq.pending,expires_at.gt.' + new Date().toISOString() + '),status.eq.accepted'
        );

      if (error) {
        console.error('Error fetching job offers:', error);
        return [];
      }

      // Filter out offers where the order is already scheduled
      return data?.filter(offer => !offer.order?.scheduled_install_date) || [];
    },
    enabled: showOfferHolds
  });

  useEffect(() => {
    setWeekStart(getWeekStart(currentDate));
  }, [currentDate]);

  // Set up real-time listeners for job offers and orders
  useEffect(() => {
    const jobOffersChannel = supabase
      .channel('job-offers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_offers'
        },
        () => {
          // Invalidate job offers query when changes occur
          queryClient.invalidateQueries({ queryKey: ['job-offers'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          // Invalidate orders-related queries when orders change
          queryClient.invalidateQueries({ queryKey: ['orders-for-calendar'] });
          queryClient.invalidateQueries({ queryKey: ['job-offers'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobOffersChannel);
    };
  }, [queryClient]);

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  function getWeekDays(startDate: Date): Date[] {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  }

  const weekDays = getWeekDays(weekStart);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(weekStart.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStart(newWeekStart);
    onDateChange(newWeekStart);
  };

  const getOrdersForEngineerAndDate = (engineerId: string, date: Date): Order[] => {
    return orders.filter(order => 
      order.engineer_id === engineerId &&
      order.scheduled_install_date &&
      new Date(order.scheduled_install_date).toDateString() === date.toDateString()
    );
  };

  const getEngineerWorkload = (engineerId: string, date: Date): number => {
    return getOrdersForEngineerAndDate(engineerId, date).length;
  };

  const getEngineerCapacityStatus = (engineerId: string, date: Date): {
    isOverCapacity: boolean;
    totalHours: number;
    workingHours: number;
  } => {
    const dayOrders = getOrdersForEngineerAndDate(engineerId, date);
    const totalHours = dayOrders.reduce((total, order) => 
      total + getOrderEstimatedHours(order), 0
    );
    
    // Assume 8-hour working day for visual indicator
    const workingHours = 8;
    const isOverCapacity = totalHours > workingHours;
    
    return { isOverCapacity, totalHours, workingHours };
  };

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  const isToday = (date: Date): boolean => {
    return date.toDateString() === new Date().toDateString();
  };

  const getOfferHoldsForEngineerAndDate = (engineerId: string, date: Date) => {
    if (!showOfferHolds) return [];
    
    return jobOffers?.filter(offer => 
      offer.engineer_id === engineerId &&
      offer.offered_date &&
      new Date(offer.offered_date).toDateString() === date.toDateString()
    ) || [];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Engineer Week View
          </CardTitle>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOfferHolds(!showOfferHolds)}
              className="flex items-center gap-2 text-xs"
            >
              {showOfferHolds ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Offer Holds
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {weekStart.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - {' '}
                {weekDays[6].toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left font-medium w-32 border-b">Engineer</th>
                {weekDays.map((day, index) => (
                  <th 
                    key={index} 
                     className={`
                       p-2 text-center font-medium border-b min-w-[140px]
                       ${isWeekend(day) ? 'bg-muted/50 text-muted-foreground' : ''}
                       ${isToday(day) ? 'bg-primary/10 text-primary font-bold' : ''}
                     `}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs">{day.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                      <span className="text-sm">{day.getDate()}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {engineers.map((engineer) => (
                <tr key={engineer.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 border-r">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{engineer.name}</span>
                      <span className="text-xs text-muted-foreground">{engineer.region}</span>
                      {!engineer.availability && (
                        <Badge variant="outline" className="text-xs w-fit mt-1 text-red-600 border-red-200">
                          Unavailable
                        </Badge>
                      )}
                    </div>
                  </td>
                   {weekDays.map((day, dayIndex) => {
                     const dayOrders = getOrdersForEngineerAndDate(engineer.id, day);
                     const offerHolds = getOfferHoldsForEngineerAndDate(engineer.id, day);
                     const workload = getEngineerWorkload(engineer.id, day);
                     const capacityStatus = getEngineerCapacityStatus(engineer.id, day);
                     const isOverloaded = workload > 2;
                     const isBusy = workload > 1;
                     const isOverCapacity = capacityStatus.isOverCapacity;
                     
                     return (
                       <td 
                         key={dayIndex} 
                         className={`
                           p-2 border-r text-center align-top
                           ${isWeekend(day) ? 'bg-muted/30' : ''}
                           ${isToday(day) ? 'bg-primary/5' : ''}
                           ${isOverCapacity ? 'bg-red-100/70 border-red-300' : ''}
                           ${isOverloaded && !isOverCapacity ? 'bg-red-50/50 border-red-200' : ''}
                           ${isBusy && !isOverloaded && !isOverCapacity ? 'bg-yellow-50/50 border-yellow-200' : ''}
                         `}
                       >
                         <div className="space-y-2 min-h-[80px] p-1">
                           {workload > 0 && (
                             <div className="flex flex-col items-center justify-center mb-2 gap-1">
                               <Badge 
                                 variant="outline" 
                                 className={`
                                   text-xs px-2 py-1
                                   ${isOverCapacity ? 'text-red-700 border-red-400 bg-red-100' : ''}
                                   ${isOverloaded && !isOverCapacity ? 'text-red-600 border-red-300 bg-red-50' : ''}
                                   ${isBusy && !isOverloaded && !isOverCapacity ? 'text-yellow-600 border-yellow-300 bg-yellow-50' : ''}
                                   ${workload === 1 && !isOverCapacity ? 'text-green-600 border-green-300 bg-green-50' : ''}
                                 `}
                               >
                                 {workload} {workload === 1 ? 'job' : 'jobs'}
                               </Badge>
                               {isOverCapacity && (
                                 <Badge variant="outline" className="text-xs px-1 py-0.5 text-red-700 border-red-400 bg-red-100">
                                   {capacityStatus.totalHours}h / {capacityStatus.workingHours}h
                                 </Badge>
                               )}
                             </div>
                           )}
                           
                            {/* Offer Holds */}
                            {offerHolds.map((offer) => (
                              <div
                                key={offer.id}
                                className="bg-amber-50 border border-dashed border-amber-300 rounded-md p-2 min-h-[50px] flex flex-col justify-between cursor-pointer hover:shadow-md transition-all duration-200 hover:border-amber-400"
                                onClick={() => offer.order_id && navigate(`/admin/order/${offer.order_id}`)}
                                onKeyDown={(e) => {
                                  if ((e.key === 'Enter' || e.key === ' ') && offer.order_id) {
                                    e.preventDefault();
                                    navigate(`/admin/order/${offer.order_id}`);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
                               <div className="space-y-1">
                                 <Badge variant="outline" className="text-xs px-1 py-0.5 text-amber-700 border-amber-400 bg-amber-100 w-fit">
                                   Offer Hold
                                 </Badge>
                                 
                                 <div className="text-xs text-muted-foreground truncate">
                                   #{offer.order?.order_number}
                                 </div>
                                 
                                 <div className="text-xs text-muted-foreground truncate">
                                   {offer.order?.client?.full_name}
                                 </div>
                               </div>
                               
                               <div className="flex items-center justify-between mt-1">
                                 {offer.time_window && (
                                   <div className="text-xs text-amber-600">{offer.time_window}</div>
                                 )}
                                 <div className="text-xs text-amber-600 capitalize">{offer.status}</div>
                               </div>
                             </div>
                           ))}
                           
                           {/* Scheduled Orders */}
                           {dayOrders.slice(0, 3).map((order) => (
                             <div
                               key={order.id}
                               className="bg-white border border-border rounded-md p-2 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/40 min-h-[60px] flex flex-col justify-between"
                               style={{ 
                                 borderLeftColor: getStatusColor(order.status_enhanced),
                                 borderLeftWidth: '3px'
                               }}
                               onClick={() => navigate(`/admin/order/${order.id}`)}
                             >
                               <div className="space-y-1">
                                 <div className="flex items-center gap-1 text-xs font-medium text-primary">
                                   <span>Install</span>
                                 </div>
                                 
                                 {order.postcode && (
                                   <div className="flex items-center gap-1 text-xs font-semibold">
                                     <MapPin className="h-3 w-3" />
                                     <span>{order.postcode}</span>
                                   </div>
                                 )}
                                 
                                 <div className="text-xs text-muted-foreground truncate">
                                   {order.client?.full_name}
                                 </div>
                               </div>
                               
                               <div className="flex items-center justify-between mt-1">
                                 {order.time_window && (
                                   <div className="text-xs text-muted-foreground">{order.time_window}</div>
                                 )}
                                 {order.estimated_duration_hours && (
                                   <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                     <Clock className="h-3 w-3" />
                                     <span>{getOrderEstimatedHours(order)}h</span>
                                   </div>
                                 )}
                               </div>
                             </div>
                           ))}
                           
                           {dayOrders.length > 3 && (
                             <div className="text-xs text-muted-foreground text-center py-1">
                               +{dayOrders.length - 3} more
                             </div>
                           )}

                           {(isOverloaded || isOverCapacity) && (
                             <div className="flex items-center justify-center mt-1">
                               <AlertTriangle className={`h-3 w-3 ${isOverCapacity ? 'text-red-600' : 'text-red-500'}`} />
                             </div>
                           )}
                         </div>
                       </td>
                     );
                   })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div>
            <span>1 Job</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div>
            <span>2 Jobs (Busy)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div>
            <span>3+ Jobs (Overloaded)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-200 border border-red-400"></div>
            <span>Over Capacity (Hours)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-100 border border-dashed border-amber-300"></div>
            <span>Offer Hold</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted"></div>
            <span>Weekend</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-l-4" style={{ borderLeftColor: '#007ACC' }}></div>
            <span>Install Jobs</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}