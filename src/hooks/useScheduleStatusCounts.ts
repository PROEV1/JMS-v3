import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StatusCounts {
  needsScheduling: number;
  dateOffered: number;
  readyToBook: number;
  scheduledToday: number;
  scheduled: number;
  completionPending: number;
  completed: number;
  cancelled: number;
  onHold: number;
  notInScheduling: number;
  unavailableEngineers: number;
}

export function useScheduleStatusCounts() {
  const [counts, setCounts] = useState<StatusCounts>({
    needsScheduling: 0,
    dateOffered: 0,
    readyToBook: 0,
    scheduledToday: 0,
    scheduled: 0,
    completionPending: 0,
    completed: 0,
    cancelled: 0,
    onHold: 0,
    notInScheduling: 0,
    unavailableEngineers: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    try {
      setLoading(true);

      // Fetch offer-based counts
      // For date-offered, we need to count pending offers for orders that have engineers and aren't back to awaiting_install_booking
      const { data: pendingOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

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
          .gt('expires_at', new Date().toISOString());

        const ordersWithActiveOffers = new Set(activeOffers?.map(offer => offer.order_id) || []);
        const uniqueRejectedOrderIds = [...new Set(rejectedOffers.map(offer => offer.order_id))]
          .filter(orderId => !ordersWithActiveOffers.has(orderId));
        dateRejectedCount = uniqueRejectedOrderIds.length;
      }

      // Fetch scheduled today count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const { count: scheduledTodayCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status_enhanced', 'scheduled')
        .gte('scheduled_install_date', today.toISOString())
        .lt('scheduled_install_date', tomorrow.toISOString());

      // Fetch new bucket counts
      const [
        scheduledResult,
        completionPendingResult,
        completedResult,
        cancelledResult,
        onHoldResult,
        notInSchedulingResult,
        unavailableEngineersResult
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'scheduled')
          .eq('scheduling_suppressed', false),
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'install_completed_pending_qa'),
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'completed'),
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'cancelled'),
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'on_hold_parts_docs'),
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('scheduling_suppressed', true)
          .neq('status_enhanced', 'cancelled')
          .neq('status_enhanced', 'on_hold_parts_docs'), // Exclude already counted on-hold jobs
        supabase.from('engineers').select('*', { count: 'exact', head: true })
          .eq('availability', false)
      ]);

      // For needs-scheduling, get count of orders with no engineer and no active offers
      // Exclude scheduling_suppressed orders
      let needsSchedulingCount = 0;
        
      // First get orders that need scheduling (no engineer assigned) and not suppressed
      const { count: unassignedOrdersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status_enhanced', 'awaiting_install_booking')
        .is('engineer_id', null)
        .eq('scheduling_suppressed', false);
        
      needsSchedulingCount = unassignedOrdersCount || 0;
        
      // Subtract any unassigned orders that have active offers
      if (needsSchedulingCount > 0) {
        const { data: activeOffers } = await supabase
          .from('job_offers')
          .select('order_id')
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString());
          
        if (activeOffers?.length) {
          const { count: unassignedOrdersWithOffersCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status_enhanced', 'awaiting_install_booking')
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
          .is('scheduled_install_date', null)
          .eq('scheduling_suppressed', false)
          .in('id', acceptedOffers.map(offer => offer.order_id));
          
        readyToBookCount = ordersWithAcceptedOffersCount || 0;
      }

      setCounts({
        needsScheduling: needsSchedulingCount,
        dateOffered: dateOfferedCount,
        readyToBook: readyToBookCount,
        scheduledToday: scheduledTodayCount,
        scheduled: scheduledResult.count || 0,
        completionPending: completionPendingResult.count || 0,
        completed: completedResult.count || 0,
        cancelled: cancelledResult.count || 0,
        onHold: onHoldResult.count || 0,
        notInScheduling: notInSchedulingResult.count || 0,
        unavailableEngineers: unavailableEngineersResult.count || 0
      });
    } catch (error) {
      console.error('Error fetching status counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    
    // Listen for refresh events
    const handleRefresh = () => fetchCounts();
    window.addEventListener('scheduling:refresh', handleRefresh);
    return () => window.removeEventListener('scheduling:refresh', handleRefresh);
  }, []);

  return { counts, loading, refetch: fetchCounts };
}
