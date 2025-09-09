-- Drop and recreate the get_schedule_status_counts_v2 function to include dateRejected count
DROP FUNCTION IF EXISTS get_schedule_status_counts_v2();

CREATE OR REPLACE FUNCTION get_schedule_status_counts_v2()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN 
  WITH counts AS (
    SELECT 
      -- Needs Scheduling: orders with status 'awaiting_install_booking' but NOT in date_accepted or scheduled states
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'awaiting_install_booking' 
        AND NOT EXISTS (
          SELECT 1 FROM job_offers jo 
          WHERE jo.order_id = o.id 
          AND jo.status = 'accepted' 
          AND jo.expires_at > NOW()
        )
        AND o.scheduled_date IS NULL
      ) AS needs_scheduling,
      
      -- Date Offered: orders with pending offers that haven't expired
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM job_offers jo 
          WHERE jo.order_id = o.id 
          AND jo.status = 'pending' 
          AND jo.expires_at > NOW()
        )
      ) AS date_offered,
      
      -- Ready to Book: orders with accepted offers or in date_accepted state
      COUNT(*) FILTER (
        WHERE (
          o.status_enhanced = 'date_accepted' 
          OR EXISTS (
            SELECT 1 FROM job_offers jo 
            WHERE jo.order_id = o.id 
            AND jo.status = 'accepted' 
            AND jo.expires_at > NOW()
          )
        )
        AND o.scheduled_date IS NULL
      ) AS ready_to_book,
      
      -- Scheduled Today: orders scheduled for today
      COUNT(*) FILTER (
        WHERE o.scheduled_date IS NOT NULL 
        AND DATE(o.scheduled_date) = CURRENT_DATE
      ) AS scheduled_today,
      
      -- Scheduled: all orders with scheduled dates in the future or today
      COUNT(*) FILTER (
        WHERE o.scheduled_date IS NOT NULL 
        AND o.status_enhanced NOT IN ('completed', 'cancelled')
      ) AS scheduled,
      
      -- Completion Pending: orders marked as completion pending
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'completion_pending'
      ) AS completion_pending,
      
      -- Completed: orders marked as completed
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'completed'
      ) AS completed,
      
      -- Date Rejected: orders with rejected offers but no active offers
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM job_offers jo_rejected 
          WHERE jo_rejected.order_id = o.id 
          AND jo_rejected.status = 'rejected'
        )
        AND NOT EXISTS (
          SELECT 1 FROM job_offers jo_active 
          WHERE jo_active.order_id = o.id 
          AND jo_active.status IN ('pending', 'accepted') 
          AND jo_active.expires_at > NOW()
        )
      ) AS date_rejected,
      
      -- Cancelled: orders marked as cancelled
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'cancelled'
      ) AS cancelled,
      
      -- On Hold: orders marked as on hold
      COUNT(*) FILTER (
        WHERE o.status_enhanced = 'on_hold'
      ) AS on_hold,
      
      -- Unavailable Engineers: engineers marked as unavailable
      (SELECT COUNT(*) FROM engineers WHERE availability = false) AS unavailable_engineers
      
    FROM orders o
    WHERE o.status_enhanced NOT IN ('completed', 'cancelled')
       OR o.status_enhanced IS NULL
  )
  SELECT json_build_object(
    'needsScheduling', COALESCE(needs_scheduling, 0),
    'dateOffered', COALESCE(date_offered, 0),
    'readyToBook', COALESCE(ready_to_book, 0),
    'scheduledToday', COALESCE(scheduled_today, 0),
    'scheduled', COALESCE(scheduled, 0),
    'completionPending', COALESCE(completion_pending, 0),
    'completed', COALESCE(completed, 0),
    'dateRejected', COALESCE(date_rejected, 0),
    'cancelled', COALESCE(cancelled, 0),
    'onHold', COALESCE(on_hold, 0),
    'unavailableEngineers', COALESCE(unavailable_engineers, 0)
  ) INTO result
  FROM counts;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;