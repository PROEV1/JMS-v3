import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BucketCounts {
  jobs: {
    needsScheduling: number;
    dateOffered: number;
    readyToBook: number;
    scheduled: number;
    inProgress: number;
    completionPending: number;
    completed: number;
    onHold: number;
    cancelled: number;
  };
  surveys: {
    awaitingSubmission: number;
    awaitingReview: number;
    reworkRequested: number;
    approved: number;
  };
  qa: {
    pending: number;
    inReview: number;
    passed: number;
    failed: number;
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
      needsScheduling: 0,
      dateOffered: 0,
      readyToBook: 0,
      scheduled: 0,
      inProgress: 0,
      completionPending: 0,
      completed: 0,
      onHold: 0,
      cancelled: 0,
    },
    surveys: {
      awaitingSubmission: 0,
      awaitingReview: 0,
      reworkRequested: 0,
      approved: 0,
    },
    qa: {
      pending: 0,
      inReview: 0,
      passed: 0,
      failed: 0,
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

      // Fetch orders with payment details for enhanced payment logic
      const { data: ordersResult } = await supabase
        .from('orders')
        .select('status_enhanced, deposit_amount, amount_paid, total_amount');

      // Fetch surveys
      const { data: surveysResult } = await supabase
        .from('client_surveys')
        .select('status');

      const orders = ordersResult || [];
      const surveys = surveysResult || [];

      // Enhanced job counts mapping
      const jobCounts = orders.reduce((acc, order) => {
        const status = order.status_enhanced;
        switch (status) {
          case 'awaiting_install_booking':
          case 'needs_scheduling':
            acc.needsScheduling++;
            break;
          case 'date_offered':
            acc.dateOffered++;
            break;
          case 'date_accepted':
            acc.readyToBook++;
            break;
          case 'scheduled':
            acc.scheduled++;
            break;
          case 'in_progress':
            acc.inProgress++;
            break;
          case 'install_completed_pending_qa':
            acc.completionPending++;
            break;
          case 'completed':
            acc.completed++;
            break;
          case 'on_hold_parts_docs':
            acc.onHold++;
            break;
          case 'cancelled':
            acc.cancelled++;
            break;
        }
        return acc;
      }, {
        needsScheduling: 0,
        dateOffered: 0,
        readyToBook: 0,
        scheduled: 0,
        inProgress: 0,
        completionPending: 0,
        completed: 0,
        onHold: 0,
        cancelled: 0
      });

      // Enhanced survey counts
      const surveyCounts = surveys.reduce((acc, survey) => {
        const status = survey.status;
        switch (status) {
          case 'draft':
            acc.awaitingSubmission++;
            break;
          case 'submitted':
          case 'under_review':
          case 'resubmitted':
            acc.awaitingReview++;
            break;
          case 'rework_requested':
            acc.reworkRequested++;
            break;
          case 'approved':
            acc.approved++;
            break;
        }
        return acc;
      }, {
        awaitingSubmission: 0,
        awaitingReview: 0,
        reworkRequested: 0,
        approved: 0
      });

      // Enhanced payment counts with deposit vs balance logic
      const paymentCounts = orders.reduce((acc, order) => {
        const depositAmount = order.deposit_amount || 0;
        const amountPaid = order.amount_paid || 0;
        const totalAmount = order.total_amount || 0;
        
        if (order.status_enhanced === 'awaiting_payment') {
          if (amountPaid < depositAmount) {
            acc.depositDue++;
          } else if (amountPaid < totalAmount) {
            acc.balanceDue++;
          }
        } else if (amountPaid >= totalAmount && totalAmount > 0) {
          acc.paid++;
        }
        
        return acc;
      }, {
        depositDue: 0,
        balanceDue: 0,
        paid: 0
      });

      // Enhanced QA counts
      const qaCounts = {
        pending: jobCounts.completionPending,
        inReview: 0, // To be implemented with QA workflow
        passed: jobCounts.completed,
        failed: 0, // To be implemented with QA workflow  
        escalated: 0 // To be implemented with escalation tracking
      };

      setBuckets({
        jobs: jobCounts,
        surveys: surveyCounts,
        qa: qaCounts,
        payments: paymentCounts
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