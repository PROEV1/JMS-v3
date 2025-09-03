import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BucketCounts {
  jobs: {
    awaitingSurvey: number;
    surveyReview: number;
    awaitingScheduling: number;
    scheduled: number;
    inProgress: number;
    qaPending: number;
    completed: number;
  };
  surveys: {
    awaitingClient: number;
    awaitingReview: number;
    reworkRequested: number;
    approved: number;
  };
  qa: {
    pending: number;
    inReview: number;
    escalated: number;
  };
  payments: {
    depositDue: number;
    balanceDue: number;
    paid: number;
  };
}

export function useOpsBuckets() {
  const [buckets, setBuckets] = useState<BucketCounts>({
    jobs: {
      awaitingSurvey: 0,
      surveyReview: 0,
      awaitingScheduling: 0,
      scheduled: 0,
      inProgress: 0,
      qaPending: 0,
      completed: 0,
    },
    surveys: {
      awaitingClient: 0,
      awaitingReview: 0,
      reworkRequested: 0,
      approved: 0,
    },
    qa: {
      pending: 0,
      inReview: 0,
      escalated: 0,
    },
    payments: {
      depositDue: 0,
      balanceDue: 0,
      paid: 0,
    },
  });
  const [loading, setLoading] = useState(true);

  const fetchBuckets = async () => {
    try {
      setLoading(true);

      // Fetch job pipeline counts
      const [
        awaitingSurveyResult,
        surveyReviewResult,
        awaitingSchedulingResult,
        scheduledResult,
        inProgressResult,
        qaPendingResult,
        completedResult,
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status_enhanced', 'awaiting_survey_submission'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status_enhanced', 'awaiting_survey_review'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status_enhanced', ['awaiting_install_booking', 'needs_scheduling']),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status_enhanced', 'scheduled'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status_enhanced', 'in_progress'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status_enhanced', 'install_completed_pending_qa'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status_enhanced', 'completed'),
      ]);

      // Fetch survey counts
      const [
        surveysAwaitingClientResult,
        surveysAwaitingReviewResult,
        surveysReworkResult,
        surveysApprovedResult,
      ] = await Promise.all([
        supabase.from('client_surveys').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('client_surveys').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'under_review', 'resubmitted']),
        supabase.from('client_surveys').select('*', { count: 'exact', head: true }).eq('status', 'rework_requested'),
        supabase.from('client_surveys').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      ]);

      // Fetch payment counts
      const [
        depositDueResult,
        balanceDueResult,
        paidResult,
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status_enhanced', 'awaiting_payment'),
        supabase.from('order_payments').select('*', { count: 'exact', head: true }).eq('payment_type', 'balance').eq('status', 'pending'),
        supabase.from('order_payments').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      ]);

      setBuckets({
        jobs: {
          awaitingSurvey: awaitingSurveyResult.count || 0,
          surveyReview: surveyReviewResult.count || 0,
          awaitingScheduling: awaitingSchedulingResult.count || 0,
          scheduled: scheduledResult.count || 0,
          inProgress: inProgressResult.count || 0,
          qaPending: qaPendingResult.count || 0,
          completed: completedResult.count || 0,
        },
        surveys: {
          awaitingClient: surveysAwaitingClientResult.count || 0,
          awaitingReview: surveysAwaitingReviewResult.count || 0,
          reworkRequested: surveysReworkResult.count || 0,
          approved: surveysApprovedResult.count || 0,
        },
        qa: {
          pending: qaPendingResult.count || 0,
          inReview: 0, // Placeholder - would need QA status tracking
          escalated: 0, // Placeholder - would need QA escalation tracking
        },
        payments: {
          depositDue: depositDueResult.count || 0,
          balanceDue: balanceDueResult.count || 0,
          paid: paidResult.count || 0,
        },
      });
    } catch (error) {
      console.error('Error fetching bucket counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuckets();

    // Set up realtime listeners
    const channel = supabase
      .channel('ops-buckets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchBuckets)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_surveys' }, fetchBuckets)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_payments' }, fetchBuckets)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { buckets, loading, refetch: fetchBuckets };
}