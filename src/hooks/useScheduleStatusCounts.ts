import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildSafeUuidInClause } from '@/utils/schedulingUtils';

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
    
    unavailableEngineers: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    try {
      setLoading(true);

      // Use status_enhanced for consistent counting with list pages
      const { count: dateOfferedCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status_enhanced', 'date_offered')
        .eq('scheduling_suppressed', false);

      // For date-rejected, use status_enhanced for consistency
      const { count: dateRejectedCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status_enhanced', 'date_rejected')
        .eq('scheduling_suppressed', false);

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
        supabase.from('engineers').select('*', { count: 'exact', head: true })
          .eq('availability', false)
      ]);

      // For needs-scheduling, get count of ALL orders (assigned and unassigned) with no active offers
      // Exclude scheduling_suppressed orders
      let needsSchedulingCount = 0;
        
      // Get active offers to exclude
      const { data: activeOffers } = await supabase
        .from('job_offers')
        .select('order_id')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      const activeOfferOrderIds = activeOffers?.map(offer => offer.order_id) || [];

      // Count ALL orders that need scheduling (regardless of engineer assignment)
      let query = supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status_enhanced', 'awaiting_install_booking')
        .eq('scheduling_suppressed', false);

      // Exclude orders with active offers
      if (activeOfferOrderIds.length > 0) {
        const safeIds = buildSafeUuidInClause(activeOfferOrderIds);
        if (safeIds) {
          query = query.not('id', 'in', `(${safeIds})`);
        }
      }

      const { count } = await query;
      needsSchedulingCount = count || 0;

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
        dateOffered: dateOfferedCount || 0,
        readyToBook: readyToBookCount,
        scheduledToday: scheduledTodayCount,
        scheduled: scheduledResult.count || 0,
        completionPending: completionPendingResult.count || 0,
        completed: completedResult.count || 0,
        cancelled: cancelledResult.count || 0,
        onHold: onHoldResult.count || 0,
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
