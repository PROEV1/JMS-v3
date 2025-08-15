import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import moment from 'moment';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarFilters } from './CalendarFilters';
import { UnassignedJobsSidebar } from './UnassignedJobsSidebar';
import { JobCard } from './JobCard';
import { SmartAssignmentModal } from './SmartAssignmentModal';
// import { JobDetailsModal } from './JobDetailsModal';
import { WeekViewCalendar } from './WeekViewCalendar';
import { EngineerRecommendationPanel } from './EngineerRecommendationPanel';
import { 
  Order, 
  Engineer, 
  formatOrderForCalendar, 
  updateOrderAssignment,
  getStatusColor 
} from '@/utils/schedulingUtils';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, Users, AlertTriangle } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    order: Order;
    engineerId?: string;
    status: string;
    conflicts: any[];
  };
}

export function AdminScheduleCalendar() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [isJobDetailsModalOpen, setIsJobDetailsModalOpen] = useState(false);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [filters, setFilters] = useState({
    engineerId: 'all-engineers',
    region: 'all-regions',
    status: 'all-statuses'
  });
  const [loading, setLoading] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [calendarView, setCalendarView] = useState<'calendar' | 'week'>('calendar');
  const [draggedJob, setDraggedJob] = useState<Order | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load orders with related data
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(*),
          engineer:engineers(*)
        `)
        .order('scheduled_install_date', { ascending: true });

      if (ordersError) throw ordersError;

      // Load engineers
      const { data: engineersData, error: engineersError } = await supabase
        .from('engineers')
        .select('*')
        .eq('availability', true);

      if (engineersError) throw engineersError;

      setOrders(ordersData || []);
      setEngineers(engineersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load scheduling data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter and format events
  useEffect(() => {
    let filteredOrders = orders.filter(order => 
      order.scheduled_install_date && order.engineer_id
    );

    // Apply filters
    if (filters.engineerId && filters.engineerId !== 'all-engineers') {
      filteredOrders = filteredOrders.filter(order => 
        order.engineer_id === filters.engineerId
      );
    }

    if (filters.region && filters.region !== 'all-regions') {
      filteredOrders = filteredOrders.filter(order => 
        order.engineer?.region === filters.region
      );
    }

    if (filters.status && filters.status !== 'all-statuses') {
      filteredOrders = filteredOrders.filter(order => 
        order.status_enhanced === filters.status
      );
    }

    const formattedEvents = filteredOrders.map(formatOrderForCalendar);
    setEvents(formattedEvents);
  }, [orders, filters]);

  // Handle drag and drop from sidebar
  const handleJobDrop = useCallback(async (
    orderId: string, 
    engineerId: string, 
    slotInfo: any
  ) => {
    try {
      await updateOrderAssignment(orderId, engineerId, slotInfo.start.toISOString());
      await loadData();
      toast.success('Job assigned successfully');
    } catch (error) {
      console.error('Error assigning job:', error);
      toast.error('Failed to assign job');
    }
  }, [loadData]);

  // Handle event selection
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedOrder(event.resource.order);
    setIsJobDetailsModalOpen(true);
  }, []);

  // Handle slot selection (for new assignments)
  const handleSelectSlot = useCallback((slotInfo: any) => {
    const currentUnassignedOrders = orders.filter(order => 
      !order.engineer_id && (order.status_enhanced === 'awaiting_install_booking' || order.status_enhanced === 'scheduled')
    );
    if (currentUnassignedOrders.length > 0) {
      setSelectedSlot(slotInfo);
      setDraggedOrder(currentUnassignedOrders[0]); // Default to first unassigned job
      setShowRecommendations(true);
    }
  }, [orders]);

  // Handle drops from external sources (sidebar)
  const handleDropFromOutside = useCallback(({ draggedEvent, start, end }: any) => {
    console.log('Drop from outside triggered:', { draggedEvent, start, end, draggedJob });
    
    if (!start) {
      console.error('Invalid drop data - no start time');
      return;
    }

    // Use the current draggedJob from state (set by sidebar drag start)
    if (!draggedJob) {
      console.error('No dragged job available');
      toast.error('No job selected for assignment');
      return;
    }

    // Set slot info for recommendations
    const slot = {
      start: new Date(start),
      end: new Date(end || start),
      resourceId: null,
      action: 'drop' as const
    };
    
    console.log('Setting slot and showing recommendations:', slot);
    setSelectedSlot(slot);
    setDraggedOrder(draggedJob);
    setShowRecommendations(true);
  }, [draggedJob]);

  // Handle job reassignment
  const handleReassignJob = useCallback(async (orderId: string, engineerId: string, date?: string) => {
    try {
      await updateOrderAssignment(orderId, engineerId, date);
      await loadData();
      toast.success('Job reassigned successfully');
    } catch (error) {
      console.error('Error reassigning job:', error);
      toast.error('Failed to reassign job');
    }
  }, [loadData]);

  // Handle job rescheduling
  const handleRescheduleJob = useCallback(async (orderId: string, date: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        await updateOrderAssignment(orderId, order.engineer_id, date);
        await loadData();
        toast.success('Job rescheduled successfully');
      }
    } catch (error) {
      console.error('Error rescheduling job:', error);
      toast.error('Failed to reschedule job');
    }
  }, [orders, loadData]);

  // Handle marking job as confirmed
  const handleMarkConfirmed = useCallback(async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', orderId);

      if (error) throw error;
      
      await loadData();
      toast.success('Job marked as confirmed');
    } catch (error) {
      console.error('Error marking job as confirmed:', error);
      toast.error('Failed to mark job as confirmed');
    }
  }, [loadData]);

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const hasConflicts = event.resource.conflicts.length > 0;
    
    return (
      <div className={`
        p-1 rounded text-xs font-medium
        ${hasConflicts ? 'border-2 border-destructive' : ''}
      `}>
        <div className="flex items-center gap-1">
          {hasConflicts && (
            <span className="text-destructive">⚠️</span>
          )}
          <span className="truncate">{event.title}</span>
        </div>
        {event.resource.order.time_window && (
          <div className="text-xs opacity-75">
            {event.resource.order.time_window}
          </div>
        )}
      </div>
    );
  };

  // Custom event style getter
  const eventStyleGetter = (event: CalendarEvent) => {
    const backgroundColor = getStatusColor(event.resource.status);
    const hasConflicts = event.resource.conflicts.length > 0;
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        border: hasConflicts ? '2px solid hsl(var(--destructive))' : 'none',
        fontSize: '12px'
      }
    };
  };

  const unassignedOrders = orders.filter(order => 
    !order.engineer_id && (order.status_enhanced === 'awaiting_install_booking' || order.status_enhanced === 'scheduled')
  );

  // Get stats for the dashboard
  const totalJobs = orders.length;
  const assignedJobs = orders.filter(o => o.engineer_id).length;
  const completedJobs = orders.filter(o => o.status_enhanced === 'completed').length;
  const busyEngineers = engineers.filter(e => 
    orders.some(o => o.engineer_id === e.id && o.scheduled_install_date)
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header with Stats */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-8 w-8" />
              Smart Job Scheduling
            </h1>
            <div className="flex gap-4 mt-2">
              <Badge variant="outline" className="text-sm">
                <Users className="h-3 w-3 mr-1" />
                {busyEngineers}/{engineers.length} Engineers Active
              </Badge>
              <Badge variant="outline" className="text-sm">
                {assignedJobs}/{totalJobs} Jobs Assigned
              </Badge>
              <Badge variant="outline" className="text-sm">
                {completedJobs} Completed
              </Badge>
              {unassignedOrders.length > 0 && (
                <Badge variant="destructive" className="text-sm">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {unassignedOrders.length} Unassigned
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setCalendarView(calendarView === 'calendar' ? 'week' : 'calendar')} 
              variant="outline"
            >
              {calendarView === 'calendar' ? 'Week View' : 'Calendar View'}
            </Button>
            <Button onClick={loadData} variant="outline">
              Refresh
            </Button>
          </div>
        </div>

        <CalendarFilters
          engineers={engineers}
          filters={filters}
          onFiltersChange={setFilters}
        />

        <div className="relative">
          {calendarView === 'week' ? (
            <WeekViewCalendar
              orders={orders}
              engineers={engineers}
              onOrderClick={(order) => {
                setSelectedOrder(order);
                setIsJobDetailsModalOpen(true);
              }}
              currentDate={date}
              onDateChange={setDate}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <UnassignedJobsSidebar
                  orders={unassignedOrders}
                  engineers={engineers}
                  onJobDrop={handleJobDrop}
                  onShowRecommendations={(order) => {
                    setDraggedOrder(order);
                    // Create a mock slot to trigger the recommendation panel
                    setSelectedSlot({
                      start: new Date(),
                      end: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
                      resourceId: null,
                      action: 'select'
                    });
                    setShowRecommendations(true);
                  }}
                  onStartDrag={(order) => {
                    setDraggedJob(order);
                  }}
                />
              </div>

              <div className="lg:col-span-3 relative">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Schedule Calendar
                      <div className="flex gap-2">
                        <Button
                          variant={view === 'month' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setView('month')}
                        >
                          Month
                        </Button>
                        <Button
                          variant={view === 'week' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setView('week')}
                        >
                          Week
                        </Button>
                        <Button
                          variant={view === 'day' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setView('day')}
                        >
                          Day
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ height: '600px' }}>
                       <Calendar
                         localizer={localizer}
                         events={events}
                         startAccessor="start"
                         endAccessor="end"
                         view={view}
                         onView={setView}
                         date={date}
                         onNavigate={setDate}
                         onSelectEvent={handleSelectEvent}
                         onSelectSlot={handleSelectSlot}
                          onDropFromOutside={handleDropFromOutside}
                          dragFromOutsideItem={() => draggedJob ? {
                            id: draggedJob.id,
                            title: `${draggedJob.order_number} - ${draggedJob.client?.full_name}`,
                          } : null}
                          selectable
                         popup
                         drilldownView={null}
                         components={{
                           event: EventComponent,
                         }}
                         eventPropGetter={eventStyleGetter}
                         step={30}
                         timeslots={2}
                         min={new Date(0, 0, 0, 8, 0, 0)}
                         max={new Date(0, 0, 0, 18, 0, 0)}
                       />
                    </div>
                  </CardContent>
                </Card>
                
                {/* Engineer Recommendation Panel - positioned absolutely */}
                {showRecommendations && draggedOrder && selectedSlot && (
                  <div className="absolute top-4 right-4 z-50">
                    <EngineerRecommendationPanel
                      order={draggedOrder}
                      engineers={engineers}
                      onSelectEngineer={async (engineerId, availableDate) => {
                        if (engineerId && availableDate) {
                          // Update the slot with the recommended date
                          const updatedSlot = {
                            ...selectedSlot,
                            start: new Date(availableDate),
                            end: new Date(availableDate)
                          };
                          await handleJobDrop(draggedOrder.id, engineerId, updatedSlot);
                        }
                        setShowRecommendations(false);
                        setDraggedOrder(null);
                        setSelectedSlot(null);
                      }}
                      isVisible={showRecommendations}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        {selectedOrder && (
          <>
            <SmartAssignmentModal
              isOpen={isAssignmentModalOpen}
              onClose={() => {
                setIsAssignmentModalOpen(false);
                setSelectedOrder(null);
              }}
              order={selectedOrder}
              engineers={engineers}
              onAssign={async (engineerId, date) => {
                await updateOrderAssignment(selectedOrder.id, engineerId, date);
                await loadData();
                toast.success('Job reassigned successfully');
              }}
            />
            
            {/* JobDetailsModal temporarily disabled for build */}
          </>
        )}
    </div>
  );
}