-- Fix date_rejected count to exclude orders that are already scheduled/completed/cancelled
DROP FUNCTION IF EXISTS get_schedule_status_counts_v2();

CREATE OR REPLACE FUNCTION get_schedule_status_counts_v2()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN 
  WITH counts AS (
    SELECT 
      -- Needs Scheduling: orders with status 'awaiting_install_booking' AND not suppressed
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'awaiting_install_booking'
        AND o.scheduling_suppressed = false
      ) AS needs_scheduling,
      
      -- Date Offered: orders with pending, non-expired job offers (matches the actual page logic)
      (
        SELECT COUNT(DISTINCT jo.order_id)
        FROM job_offers jo
        JOIN orders o_offered ON jo.order_id = o_offered.id
        WHERE jo.status = 'pending'
          AND jo.expires_at > NOW()
          AND o_offered.scheduling_suppressed = false
      ) AS date_offered,
      
      -- Ready to Book: orders with status 'date_accepted'
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'date_accepted'
      ) AS ready_to_book,
      
      -- Date Rejected: orders that have rejected offers but NO active offers AND not already scheduled/completed
      (
        SELECT COUNT(DISTINCT jo_rejected.order_id)
        FROM job_offers jo_rejected
        JOIN orders o_rejected ON jo_rejected.order_id = o_rejected.id
        WHERE jo_rejected.status = 'rejected'
          AND o_rejected.scheduling_suppressed = false
          AND o_rejected.status_enhanced NOT IN ('scheduled', 'in_progress', 'install_completed_pending_qa', 'completed', 'cancelled')
          AND NOT EXISTS (
            SELECT 1 FROM job_offers jo_active 
            WHERE jo_active.order_id = jo_rejected.order_id 
              AND jo_active.status IN ('pending', 'accepted')
              AND jo_active.expires_at > NOW()
          )
      ) AS date_rejected,
      
      -- Expired Offers: orders with status 'offer_expired'
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'offer_expired'
      ) AS offer_expired,
      
      -- Scheduled Today: orders with status 'scheduled' and scheduled for today
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'scheduled'
        AND o.scheduled_install_date IS NOT NULL 
        AND DATE(o.scheduled_install_date) = CURRENT_DATE
      ) AS scheduled_today,
      
      -- Scheduled: orders with status 'scheduled'
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'scheduled'
      ) AS scheduled,
      
      -- Completion Pending: orders with status 'install_completed_pending_qa'
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'install_completed_pending_qa'
      ) AS completion_pending,
      
      -- Completed: orders with status 'completed'
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'completed'
      ) AS completed,
      
      -- Cancelled: orders with status 'cancelled'
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'cancelled'
      ) AS cancelled,
      
      -- On Hold: orders with status 'on_hold_parts_docs' OR scheduling_suppressed = true
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'on_hold_parts_docs' 
        OR o.scheduling_suppressed = true
      ) AS on_hold,
      
      -- Unavailable Engineers: engineers marked as unavailable
      (SELECT COUNT(*) FROM engineers WHERE availability = false) AS unavailable_engineers
      
    FROM orders o
  )
  SELECT json_build_object(
    'needsScheduling', COALESCE(needs_scheduling, 0),
    'dateOffered', COALESCE(date_offered, 0),
    'readyToBook', COALESCE(ready_to_book, 0),
    'dateRejected', COALESCE(date_rejected, 0),
    'offerExpired', COALESCE(offer_expired, 0),
    'scheduledToday', COALESCE(scheduled_today, 0),
    'scheduled', COALESCE(scheduled, 0),
    'completionPending', COALESCE(completion_pending, 0),
    'completed', COALESCE(completed, 0),
    'cancelled', COALESCE(cancelled, 0),
    'onHold', COALESCE(on_hold, 0),
    'unavailableEngineers', COALESCE(unavailable_engineers, 0)
  ) INTO result
  FROM counts;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;