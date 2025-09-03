import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OpsKpiData {
  quotesAwaitingAction: number;
  surveysAwaitingReview: number;
  jobsAwaitingScheduling: number;
  jobsScheduledThisWeek: number;
  installsAtRisk: number;
  paymentsOverdue: number;
  qaBacklog: number;
  partnerBlockedJobs: number;
}

export function useOpsKpis() {
  const [kpis, setKpis] = useState<OpsKpiData>({
    quotesAwaitingAction: 0,
    surveysAwaitingReview: 0,
    jobsAwaitingScheduling: 0,
    jobsScheduledThisWeek: 0,
    installsAtRisk: 0,
    paymentsOverdue: 0,
    qaBacklog: 0,
    partnerBlockedJobs: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchKpis = async () => {
    try {
      setLoading(true);

      // Calculate week boundaries
      const today = new Date();
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      // Fetch all KPIs in parallel
      const [
        quotesResult,
        surveysResult,
        awaitingSchedulingResult,
        scheduledThisWeekResult,
        installsAtRiskResult,
        paymentsOverdueResult,
        qaBacklogResult,
        partnerBlockedResult,
      ] = await Promise.all([
        // Quotes awaiting action (sent status)
        supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .in('status', ['sent', 'viewed']),

        // Surveys pending review
        supabase
          .from('client_surveys')
          .select('*', { count: 'exact', head: true })
          .in('status', ['submitted', 'under_review', 'resubmitted']),

        // Jobs awaiting scheduling
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status_enhanced', ['awaiting_install_booking', 'needs_scheduling'])
          .eq('scheduling_suppressed', false),

        // Jobs scheduled this week
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .gte('scheduled_install_date', startOfWeek.toISOString().split('T')[0])
          .lte('scheduled_install_date', endOfWeek.toISOString().split('T')[0])
          .eq('status_enhanced', 'scheduled'),

        // Installs at risk (scheduled within 24h with incomplete requirements)
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .gte('scheduled_install_date', new Date().toISOString().split('T')[0])
          .lte('scheduled_install_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .is('agreement_signed_at', null),

        // Payments overdue (pending over 7 days)
        supabase
          .from('order_payments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

        // QA backlog (completed pending QA)
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status_enhanced', 'install_completed_pending_qa'),

        // Partner blocked jobs
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('is_partner_job', true)
          .eq('status_enhanced', 'on_hold_parts_docs'),
      ]);

      setKpis({
        quotesAwaitingAction: quotesResult.count || 0,
        surveysAwaitingReview: surveysResult.count || 0,
        jobsAwaitingScheduling: awaitingSchedulingResult.count || 0,
        jobsScheduledThisWeek: scheduledThisWeekResult.count || 0,
        installsAtRisk: installsAtRiskResult.count || 0,
        paymentsOverdue: paymentsOverdueResult.count || 0,
        qaBacklog: qaBacklogResult.count || 0,
        partnerBlockedJobs: partnerBlockedResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();

    // Set up realtime listeners
    const ordersChannel = supabase
      .channel('ops-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchKpis)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, fetchKpis)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_surveys' }, fetchKpis)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_payments' }, fetchKpis)
      .subscribe();

    // Listen for scheduling refresh events
    const handleSchedulingRefresh = () => fetchKpis();
    window.addEventListener('scheduling:refresh', handleSchedulingRefresh);

    return () => {
      supabase.removeChannel(ordersChannel);
      window.removeEventListener('scheduling:refresh', handleSchedulingRefresh);
    };
  }, []);

  return { kpis, loading, refetch: fetchKpis };
}