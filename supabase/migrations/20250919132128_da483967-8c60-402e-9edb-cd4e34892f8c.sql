-- Fix migration: Drop and recreate functions with new return types
-- 1. First, add the new enum values
ALTER TYPE order_status_enhanced ADD VALUE IF NOT EXISTS 'awaiting_parts_order';
ALTER TYPE order_status_enhanced ADD VALUE IF NOT EXISTS 'awaiting_manual_scheduling';

-- 2. Add parts_ordered field to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS parts_ordered boolean DEFAULT false;

-- 3. Drop and recreate the status counts function
DROP FUNCTION IF EXISTS public.get_schedule_status_counts_v2();

CREATE OR REPLACE FUNCTION public.get_schedule_status_counts_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
AS $function$
DECLARE
  needs_scheduling_count INTEGER;
  date_offered_count INTEGER;
  ready_to_book_count INTEGER;
  date_rejected_count INTEGER;
  offer_expired_count INTEGER;
  scheduled_today_count INTEGER;
  scheduled_count INTEGER;
  completion_pending_count INTEGER;
  completed_count INTEGER;
  cancelled_count INTEGER;
  on_hold_count INTEGER;
  unavailable_engineers_count INTEGER;
  awaiting_parts_order_count INTEGER;
  awaiting_manual_scheduling_count INTEGER;
BEGIN
  -- Count orders that need scheduling (awaiting_install_booking status)
  SELECT COUNT(*) INTO needs_scheduling_count
  FROM orders
  WHERE status_enhanced = 'awaiting_install_booking';

  -- Count orders with date offered (pending offers that haven't expired)
  SELECT COUNT(*) INTO date_offered_count
  FROM orders
  WHERE status_enhanced = 'date_offered';

  -- Count orders ready to book (accepted offers, no scheduled date yet)
  SELECT COUNT(*) INTO ready_to_book_count
  FROM orders
  WHERE status_enhanced = 'date_accepted';

  -- Count orders with rejected dates
  SELECT COUNT(*) INTO date_rejected_count
  FROM orders
  WHERE status_enhanced = 'date_rejected';

  -- Count orders with expired offers
  SELECT COUNT(*) INTO offer_expired_count
  FROM orders
  WHERE status_enhanced = 'offer_expired';

  -- Count scheduled installations for today
  SELECT COUNT(*) INTO scheduled_today_count
  FROM orders
  WHERE status_enhanced = 'scheduled'
    AND scheduled_install_date::date = CURRENT_DATE;

  -- Count all scheduled installations (future and today)
  SELECT COUNT(*) INTO scheduled_count
  FROM orders
  WHERE status_enhanced = 'scheduled';

  -- Count completion pending
  SELECT COUNT(*) INTO completion_pending_count
  FROM orders
  WHERE status_enhanced = 'install_completed_pending_qa';

  -- Count completed orders
  SELECT COUNT(*) INTO completed_count
  FROM orders
  WHERE status_enhanced = 'completed';

  -- Count cancelled orders
  SELECT COUNT(*) INTO cancelled_count
  FROM orders
  WHERE status_enhanced = 'cancelled';

  -- Count on-hold orders
  SELECT COUNT(*) INTO on_hold_count
  FROM orders
  WHERE status_enhanced = 'on_hold_parts_docs';

  -- Count orders awaiting parts order
  SELECT COUNT(*) INTO awaiting_parts_order_count
  FROM orders
  WHERE status_enhanced = 'awaiting_parts_order';

  -- Count orders awaiting manual scheduling
  SELECT COUNT(*) INTO awaiting_manual_scheduling_count
  FROM orders
  WHERE status_enhanced = 'awaiting_manual_scheduling';

  -- Count unavailable engineers (placeholder for now)
  unavailable_engineers_count := 0;

  -- Return all counts as JSON
  RETURN jsonb_build_object(
    'needsScheduling', needs_scheduling_count,
    'dateOffered', date_offered_count,
    'readyToBook', ready_to_book_count,
    'dateRejected', date_rejected_count,
    'offerExpired', offer_expired_count,
    'scheduledToday', scheduled_today_count,
    'scheduled', scheduled_count,
    'completionPending', completion_pending_count,
    'completed', completed_count,
    'cancelled', cancelled_count,
    'onHold', on_hold_count,
    'unavailableEngineers', unavailable_engineers_count,
    'awaitingPartsOrder', awaiting_parts_order_count,
    'awaitingManualScheduling', awaiting_manual_scheduling_count
  );
END;
$function$;