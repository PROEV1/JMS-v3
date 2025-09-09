import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StatusCounts {
  needsScheduling: number;
  dateOffered: number;
  readyToBook: number;
  dateRejected: number;
  offerExpired: number;
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
    dateRejected: 0,
    offerExpired: 0,
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
    const startTime = performance.now();
    try {
      setLoading(true);

      // Use optimized RPC for all counts in one call
      const { data, error } = await supabase.rpc('get_schedule_status_counts_v2');
      
      if (error) {
        console.error('Error fetching status counts:', error);
        return;
      }

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        console.log('📊 Raw status counts data:', data);
        const counts = data as unknown as StatusCounts;
        const newCounts = {
          needsScheduling: counts.needsScheduling || 0,
          dateOffered: counts.dateOffered || 0,
          readyToBook: counts.readyToBook || 0,
          dateRejected: counts.dateRejected || 0,
          offerExpired: counts.offerExpired || 0,
          scheduledToday: counts.scheduledToday || 0,
          scheduled: counts.scheduled || 0,
          completionPending: counts.completionPending || 0,
          completed: counts.completed || 0,
          cancelled: counts.cancelled || 0,
          onHold: counts.onHold || 0,
          unavailableEngineers: counts.unavailableEngineers || 0
        };
        console.log('📊 Processed counts:', newCounts);
        setCounts(newCounts);
      }
    } catch (error) {
      console.error('Error fetching status counts:', error);
    } finally {
      setLoading(false);
      const endTime = performance.now();
      console.log(`📊 Status counts loaded in ${(endTime - startTime).toFixed(2)}ms`);
    }
  };

  useEffect(() => {
    fetchCounts();
    
    // Set up real-time subscriptions for orders and job_offers
    const countsChannel = supabase
      .channel('schedule-counts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_offers' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'engineers' }, fetchCounts)
      .subscribe();
    
    // Listen for refresh events
    const handleRefresh = () => fetchCounts();
    window.addEventListener('scheduling:refresh', handleRefresh);
    
    return () => {
      supabase.removeChannel(countsChannel);
      window.removeEventListener('scheduling:refresh', handleRefresh);
    };
  }, []);

  return { counts, loading, refetch: fetchCounts };
}