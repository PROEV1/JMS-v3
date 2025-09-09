-- Fix date_rejected count to match the actual list page logic
DROP FUNCTION IF EXISTS get_schedule_status_counts_v2();

CREATE OR REPLACE FUNCTION get_schedule_status_counts_v2()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN 
  WITH counts AS (
    SELECT 
      -- Needs Scheduling: orders with status 'awaiting_install_booking' 
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'awaiting_install_booking'
      ) AS needs_scheduling,
      
      -- Date Offered: orders with status 'date_offered'
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'date_offered'
      ) AS date_offered,
      
      -- Ready to Book: orders with status 'date_accepted'
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'date_accepted'
      ) AS ready_to_book,
      
      -- Date Rejected: orders that have rejected offers but NO active offers
      (
        SELECT COUNT(DISTINCT jo_rejected.order_id)
        FROM job_offers jo_rejected
        WHERE jo_rejected.status = 'rejected'
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
      
      -- On Hold: orders with status 'on_hold_parts_docs'
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'on_hold_parts_docs'
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
$$ LANGUAGE plpgsql SECURITY DEFINER;