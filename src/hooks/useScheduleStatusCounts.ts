import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ScheduleStatusCounts {
  needsScheduling: number;
  dateOffered: number;
  readyToBook: number;
  dateRejected: number;
  offerExpired: number;
  scheduled: number;
  onHold: number;
  scheduledToday: number;
  unavailableEngineers: number;
}

export function useScheduleStatusCounts() {
  const [counts, setCounts] = useState<ScheduleStatusCounts>({
    needsScheduling: 0,
    dateOffered: 0,
    readyToBook: 0,
    dateRejected: 0,
    offerExpired: 0,
    scheduled: 0,
    onHold: 0,
    scheduledToday: 0,
    unavailableEngineers: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);

      // Fetch offer-based counts
      // For date-offered, we need to count pending offers for orders that have engineers and aren't back to awaiting_install_booking
      const { data: pendingOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'pending')
        .gt('expires_at', now.toISOString());

      let dateOfferedCount = 0;
      if (pendingOffers?.length) {
        // Count unique order IDs with pending offers (regardless of order status)
        const uniqueOrderIds = [...new Set(pendingOffers.map(offer => offer.order_id))];
        dateOfferedCount = uniqueOrderIds.length;
      }

      // For date-rejected, count unique orders with rejected offers but no active offers
      let dateRejectedCount = 0;
      const { data: rejectedOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'rejected');

      if (rejectedOffers?.length) {
        const { data: activeOffers } = await supabase
          .from('job_offers')
          .select('order_id')
          .in('status', ['pending', 'accepted'])
          .gt('expires_at', now.toISOString());

        const ordersWithActiveOffers = new Set(activeOffers?.map(offer => offer.order_id) || []);
        const uniqueRejectedOrderIds = [...new Set(rejectedOffers.map(offer => offer.order_id))]
          .filter(orderId => !ordersWithActiveOffers.has(orderId));
        dateRejectedCount = uniqueRejectedOrderIds.length;
      }

      const expiredResult = await supabase
        .from('job_offers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'expired');

      // Fetch order-based counts - exclude scheduling_suppressed orders from active flow
      const [scheduledResult, onHoldResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'scheduled')
          .eq('scheduling_suppressed', false)
          .eq('job_type', 'installation'),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .or('status_enhanced.eq.on_hold_parts_docs,scheduling_suppressed.eq.true')
          .eq('job_type', 'installation')
      ]);

      // Scheduled installations for today
      const scheduledTodayResult = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status_enhanced', 'scheduled')
        .eq('job_type', 'installation')
        .gte('scheduled_install_date', now.toISOString().split('T')[0])
        .lt('scheduled_install_date', tomorrow.toISOString().split('T')[0]);

      // For needs-scheduling, get count of orders with no engineer and no active offers
      // Exclude scheduling_suppressed orders
      let needsSchedulingCount = 0;
      
      // First get orders that need scheduling (no engineer assigned) and not suppressed
      const { count: unassignedOrdersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status_enhanced', 'awaiting_install_booking')
        .eq('job_type', 'installation')
        .is('engineer_id', null)
        .eq('scheduling_suppressed', false);
      
      needsSchedulingCount = unassignedOrdersCount || 0;
      
      // Subtract any unassigned orders that have active offers
      if (needsSchedulingCount > 0) {
        const { data: activeOffers } = await supabase
          .from('job_offers')
          .select('order_id')
          .eq('status', 'pending')
          .gt('expires_at', now.toISOString());
        
        if (activeOffers?.length) {
          const { count: unassignedOrdersWithOffersCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'awaiting_install_booking')
            .eq('job_type', 'installation')
            .is('engineer_id', null)
            .eq('scheduling_suppressed', false)
            .in('id', activeOffers.map(offer => offer.order_id));
          
          needsSchedulingCount = Math.max(0, needsSchedulingCount - (unassignedOrdersWithOffersCount || 0));
        }
      }

      // For ready-to-book, count orders with accepted offers that haven't been scheduled yet
      // Exclude scheduling_suppressed orders
      let readyToBookCount = 0;
      const { data: acceptedOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'accepted');
      
      if (acceptedOffers?.length) {
        const { count: ordersWithAcceptedOffersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'awaiting_install_booking')
          .eq('job_type', 'installation')
          .is('scheduled_install_date', null)
          .eq('scheduling_suppressed', false)
          .in('id', acceptedOffers.map(offer => offer.order_id));
        
        readyToBookCount = ordersWithAcceptedOffersCount || 0;
      }

      // Unavailable engineers calculation
      const todayDayOfWeek = now.getDay();
      const todayStr = now.toISOString().split('T')[0];
      
      const { data: engineers } = await supabase
        .from('engineers')
        .select(`
          id,
          availability,
          engineer_availability(day_of_week, is_available),
          engineer_time_off(start_date, end_date, status)
        `);
      
      let unavailableEngineersCount = 0;
      
      if (engineers) {
        for (const engineer of engineers) {
          // Check global availability
          if (!engineer.availability) {
            unavailableEngineersCount++;
            continue;
          }
          
          // Check day-of-week availability
          const dayAvailability = engineer.engineer_availability?.find(
            (avail: any) => avail.day_of_week === todayDayOfWeek
          );
          if (dayAvailability && !dayAvailability.is_available) {
            unavailableEngineersCount++;
            continue;
          }
          
          // Check approved time off for today
          const hasTimeOffToday = engineer.engineer_time_off?.some((timeOff: any) => {
            const startDate = new Date(timeOff.start_date);
            const endDate = new Date(timeOff.end_date);
            const today = new Date(todayStr);
            return timeOff.status === 'approved' && 
                   today >= startDate && 
                   today <= endDate;
          });
          
          if (hasTimeOffToday) {
            unavailableEngineersCount++;
          }
        }
      }

      setCounts({
        needsScheduling: needsSchedulingCount,
        dateOffered: dateOfferedCount,
        readyToBook: readyToBookCount,
        dateRejected: dateRejectedCount,
        offerExpired: expiredResult.count || 0,
        scheduled: scheduledResult.count || 0,
        onHold: onHoldResult.count || 0,
        scheduledToday: scheduledTodayResult.count || 0,
        unavailableEngineers: unavailableEngineersCount
      });
    } catch (error) {
      console.error('Error fetching status counts:', error);
      setCounts({
        needsScheduling: 0,
        dateOffered: 0,
        readyToBook: 0,
        dateRejected: 0,
        offerExpired: 0,
        scheduled: 0,
        onHold: 0,
        scheduledToday: 0,
        unavailableEngineers: 0
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    
    // Listen for scheduling refresh events
    const handleRefresh = () => {
      fetchCounts();
    };
    
    window.addEventListener('scheduling:refresh', handleRefresh);
    return () => window.removeEventListener('scheduling:refresh', handleRefresh);
  }, []);

  return { 
    counts, 
    loading, 
    refetch: () => {
      setLoading(true);
      fetchCounts();
    }
  };
}