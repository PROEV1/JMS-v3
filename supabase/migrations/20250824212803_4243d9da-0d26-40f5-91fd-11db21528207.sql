-- Fix order status calculation to prioritize survey review over payment
-- when a survey has been submitted

-- Update the specific order that should show awaiting_survey_review
UPDATE orders 
SET status_enhanced = 'awaiting_survey_review'::order_status_enhanced,
    manual_status_override = true,
    manual_status_notes = 'Survey submitted - awaiting review (overridden because survey should take precedence)'
WHERE id = '4f3b0f14-9f37-4e9c-882d-f556f5b052a8';

-- Create an admin function to manually set order status when needed
CREATE OR REPLACE FUNCTION public.admin_set_order_status(
  p_order_id UUID,
  p_status order_status_enhanced,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to use this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Update the order status with manual override
  UPDATE orders 
  SET status_enhanced = p_status,
      manual_status_override = true,
      manual_status_notes = p_reason,
      updated_at = now()
  WHERE id = p_order_id;

  -- Log the status change
  PERFORM log_order_activity(
    p_order_id,
    'status_manual_override',
    'Status manually set to ' || p_status::text,
    jsonb_build_object(
      'new_status', p_status,
      'reason', p_reason,
      'admin_user', auth.uid()
    )
  );

  RETURN true;
END;
$$;