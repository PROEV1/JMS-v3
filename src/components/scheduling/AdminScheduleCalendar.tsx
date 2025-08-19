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
import { SchedulePipelineDashboard } from './SchedulePipelineDashboard';
import { 
  Order, 
  Engineer, 
  formatOrderForCalendar, 
  updateOrderAssignment,
  getStatusColor,
  EngineerSettings
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
    order?: Order;
    jobOffer?: any;
    engineerId?: string;
    status: string;
    conflicts: any[];
    isOfferHold?: boolean;
  };
  extendedProps?: {
    orderId: string;
    orderNumber: string;
    clientName: string;
    engineerName: string;
    status: string;
    address: string;
  };
}

export function AdminScheduleCalendar() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [jobOffers, setJobOffers] = useState<any[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [isJobDetailsModalOpen, setIsJobDetailsModalOpen] = useState(false);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [filters, setFilters] = useState({
    engineerId: 'all-engineers',
    region: 'all-regions',
    status: 'all-statuses',
    showOfferHolds: true
  });
  const [loading, setLoading] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [calendarView, setCalendarView] = useState<'calendar' | 'week' | 'kanban'>('calendar');
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

      // Load active job offers (pending and accepted, not expired)
      const { data: offersData, error: offersError } = await supabase
        .from('job_offers')
        .select(`
          *,
          order:orders(*),
          engineer:engineers(*)
        `)
        .in('status', ['pending', 'accepted'])
        .gt('expires_at', new Date().toISOString());

      if (offersError) throw offersError;

      setOrders(ordersData || []);
      setEngineers(engineersData || []);
      setJobOffers(offersData || []);
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

  // Helper to format job offers as calendar events
  const formatOfferForCalendar = (offer: any): CalendarEvent => {
    const start = new Date(offer.offered_date);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4 hour duration
    
    return {
      id: `offer-${offer.id}`,
      title: `[OFFER HOLD] ${offer.order?.order_number} - ${offer.order?.client?.full_name}`,
      start,
      end,
      resource: {
        jobOffer: offer,
        engineerId: offer.engineer_id,
        status: offer.status,
        conflicts: [],
        isOfferHold: true
      },
      extendedProps: {
        orderId: offer.order?.id || '',
        orderNumber: offer.order?.order_number || '',
        clientName: offer.order?.client?.full_name || '',
        engineerName: offer.engineer?.name || '',
        status: offer.status,
        address: offer.order?.job_address || ''
      }
    };
  };

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
    
    // Add offer holds if enabled
    if (filters.showOfferHolds) {
      let filteredOffers = jobOffers;
      
      // Apply same filters to offers
      if (filters.engineerId && filters.engineerId !== 'all-engineers') {
        filteredOffers = filteredOffers.filter(offer => 
          offer.engineer_id === filters.engineerId
        );
      }

      if (filters.region && filters.region !== 'all-regions') {
        filteredOffers = filteredOffers.filter(offer => 
          offer.engineer?.region === filters.region
        );
      }

      const offerEvents = filteredOffers.map(formatOfferForCalendar);
      formattedEvents.push(...offerEvents as any);
    }
    
    setEvents(formattedEvents);
  }, [orders, jobOffers, filters]);

  // Handle drag and drop from sidebar
  const handleJobDrop = useCallback(async (
    orderId: string, 
    engineerId: string, 
    slotInfo: any
  ) => {
    try {
      // Check for existing offer holds at this time
      const conflictingOffer = jobOffers.find(offer => {
        if (offer.engineer_id !== engineerId) return false;
        
        const offerStart = new Date(offer.offered_date);
        const offerEnd = new Date(offerStart.getTime() + 4 * 60 * 60 * 1000);
        const slotStart = new Date(slotInfo.start);
        const slotEnd = new Date(slotInfo.end);
        
        return (slotStart < offerEnd && slotEnd > offerStart);
      });
      
      if (conflictingOffer) {
        toast.error(`Cannot assign job: There's an existing offer hold for ${conflictingOffer.order?.order_number} at this time`);
        return;
      }

      // Check if assignment would exceed engineer's capacity
      const order = orders.find(o => o.id === orderId);
      const engineer = engineers.find(e => e.id === engineerId);
      
      if (order && engineer) {
        const { wouldExceedCapacity } = await import('@/utils/dayFitUtils');
        const engineerSettings: EngineerSettings = {
          id: engineer.id,
          name: engineer.name,
          email: engineer.email,
          starting_postcode: engineer.starting_postcode || null,
          availability: engineer.availability,
          service_areas: [],
          working_hours: [
            { day_of_week: 1, start_time: '08:00', end_time: '17:00', is_available: true },
            { day_of_week: 2, start_time: '08:00', end_time: '17:00', is_available: true },
            { day_of_week: 3, start_time: '08:00', end_time: '17:00', is_available: true },
            { day_of_week: 4, start_time: '08:00', end_time: '17:00', is_available: true },
            { day_of_week: 5, start_time: '08:00', end_time: '17:00', is_available: true }
          ],
          time_off: []
        };
        
        const { wouldExceed, reason } = await wouldExceedCapacity(
          engineerSettings,
          slotInfo.start,
          order
        );
        
        if (wouldExceed) {
          toast.error(`Cannot assign job: ${reason}`);
          return;
        }
      }

      await updateOrderAssignment(orderId, engineerId, slotInfo.start.toISOString());
      await loadData();
      toast.success('Job assigned successfully');
    } catch (error) {
      console.error('Error assigning job:', error);
      toast.error('Failed to assign job');
    }
  }, [loadData, orders, engineers, jobOffers]);

  // Handle event selection
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedOrder(event.resource.order);
    setIsJobDetailsModalOpen(true);
  }, []);

  // Handle slot selection (for new assignments)
  const handleSelectSlot = useCallback((slotInfo: any) => {
    const currentUnassignedOrders = orders.filter(order => 
      !order.engineer_id && (
        order.status_enhanced === 'awaiting_install_booking' || 
        order.status_enhanced === 'scheduled' ||
        order.status_enhanced === 'needs_scheduling' ||
        order.status_enhanced === 'date_rejected' ||
        order.status_enhanced === 'offer_expired'
      )
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
    const isOfferHold = event.resource.isOfferHold;
    
    return (
      <div className={`
        p-1 rounded text-xs font-medium
        ${hasConflicts ? 'border-2 border-destructive' : ''}
        ${isOfferHold ? 'border-2 border-dashed border-orange-400' : ''}
      `}>
        <div className="flex items-center gap-1">
          {hasConflicts && (
            <span className="text-destructive">⚠️</span>
          )}
          {isOfferHold && (
            <span className="text-orange-500">🔒</span>
          )}
          <span className="truncate">{event.title}</span>
        </div>
        {event.resource.order?.time_window && (
          <div className="text-xs opacity-75">
            {event.resource.order.time_window}
          </div>
        )}
        {isOfferHold && (
          <div className="text-xs opacity-75 text-orange-600">
            Expires: {new Date(event.resource.jobOffer.expires_at).toLocaleString()}
          </div>
        )}
      </div>
    );
  };

  // Custom event style getter
  const eventStyleGetter = (event: CalendarEvent) => {
    const isOfferHold = event.resource.isOfferHold;
    const backgroundColor = isOfferHold ? '#FED7AA' : getStatusColor(event.resource.status);
    const hasConflicts = event.resource.conflicts.length > 0;
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: isOfferHold ? 0.6 : 0.8,
        border: hasConflicts ? '2px solid hsl(var(--destructive))' : 
                isOfferHold ? '2px dashed #FB923C' : 'none',
        fontSize: '12px'
      }
    };
  };

  const unassignedOrders = orders.filter(order => 
    !order.engineer_id && (
      order.status_enhanced === 'awaiting_install_booking' || 
      order.status_enhanced === 'scheduled' ||
      order.status_enhanced === 'needs_scheduling' ||
      order.status_enhanced === 'date_rejected' ||
      order.status_enhanced === 'offer_expired'
    )
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
              onClick={() => {
                const views: ('calendar' | 'week' | 'kanban')[] = ['calendar', 'week', 'kanban'];
                const currentIndex = views.indexOf(calendarView);
                const nextIndex = (currentIndex + 1) % views.length;
                setCalendarView(views[nextIndex]);
              }} 
              variant="outline"
            >
              {calendarView === 'calendar' ? 'Week View' : 
               calendarView === 'week' ? 'Pipeline View' : 'Calendar View'}
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
          {calendarView === 'kanban' ? (
            <SchedulePipelineDashboard
              orders={orders}
            />
          ) : calendarView === 'week' ? (
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
              onAssign={async (engineerId, date, action) => {
                if (action === 'send_offer') {
                  // Send offer to client
                  try {
                     const { data, error } = await supabase.functions.invoke('send-offer', {
                       body: {
                         order_id: selectedOrder.id,
                         engineer_id: engineerId,
                         offered_date: date,
                         time_window: selectedOrder.time_window || 'AM',
                         delivery_channel: 'email'
                       }
                     });

                     if (error || data?.error) {
                       throw new Error(data?.error || 'Failed to send offer');
                     }
                     
                     await loadData();
                     // Trigger refresh for status tiles
                     window.dispatchEvent(new CustomEvent('scheduling:refresh'));
                     toast.success('Offer sent to client successfully');
                  } catch (error: any) {
                    console.error('Error sending offer:', error);
                    toast.error(error.message || 'Failed to send offer to client');
                    throw error; // Re-throw so modal can handle it
                  }
                } else {
                  // Confirm and book the job
                  await updateOrderAssignment(selectedOrder.id, engineerId, date);
                  await loadData();
                  toast.success('Job scheduled successfully');
                }
              }}
            />
            
            {/* JobDetailsModal temporarily disabled for build */}
          </>
        )}
    </div>
  );
}