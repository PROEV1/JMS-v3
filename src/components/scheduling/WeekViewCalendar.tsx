import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Order, Engineer, getStatusColor } from '@/utils/schedulingUtils';
import { ChevronLeft, ChevronRight, User, AlertTriangle } from 'lucide-react';

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

  useEffect(() => {
    setWeekStart(getWeekStart(currentDate));
  }, [currentDate]);

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

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  const isToday = (date: Date): boolean => {
    return date.toDateString() === new Date().toDateString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Engineer Week View
          </CardTitle>
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
                      p-2 text-center font-medium border-b min-w-[120px]
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
                    const workload = getEngineerWorkload(engineer.id, day);
                    const isOverloaded = workload > 2;
                    const isBusy = workload > 1;
                    
                    return (
                      <td 
                        key={dayIndex} 
                        className={`
                          p-1 border-r text-center align-top
                          ${isWeekend(day) ? 'bg-muted/30' : ''}
                          ${isToday(day) ? 'bg-primary/5' : ''}
                          ${isOverloaded ? 'bg-red-50 border-red-200' : ''}
                          ${isBusy && !isOverloaded ? 'bg-yellow-50 border-yellow-200' : ''}
                        `}
                      >
                        <div className="space-y-1 min-h-[60px]">
                          {workload > 0 && (
                            <div className="flex items-center justify-center mb-1">
                              <Badge 
                                variant="outline" 
                                className={`
                                  text-xs px-1 py-0
                                  ${isOverloaded ? 'text-red-600 border-red-300' : ''}
                                  ${isBusy && !isOverloaded ? 'text-yellow-600 border-yellow-300' : ''}
                                  ${workload === 1 ? 'text-green-600 border-green-300' : ''}
                                `}
                              >
                                {workload} {workload === 1 ? 'job' : 'jobs'}
                              </Badge>
                            </div>
                          )}
                          
                          {dayOrders.slice(0, 2).map((order) => (
                            <div
                              key={order.id}
                              className="text-xs p-1 rounded cursor-pointer hover:shadow-sm transition-shadow"
                              style={{ 
                                backgroundColor: getStatusColor(order.status_enhanced) + '20',
                                borderLeft: `3px solid ${getStatusColor(order.status_enhanced)}`
                              }}
                              onClick={() => onOrderClick(order)}
                            >
                              <div className="font-medium truncate">{order.order_number}</div>
                              <div className="text-xs opacity-75 truncate">
                                {order.client?.full_name}
                              </div>
                              {order.time_window && (
                                <div className="text-xs opacity-60">{order.time_window}</div>
                              )}
                            </div>
                          ))}
                          
                          {dayOrders.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayOrders.length - 2} more
                            </div>
                          )}

                          {isOverloaded && (
                            <div className="flex items-center justify-center mt-1">
                              <AlertTriangle className="h-3 w-3 text-red-500" />
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
            <div className="w-3 h-3 rounded bg-muted"></div>
            <span>Weekend</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}