-- Fix the expected_duration_days constraint that might be causing issues
-- Remove the existing constraint and add a more flexible one
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_expected_duration_days_check;

-- Add a new constraint that allows reasonable duration values
ALTER TABLE public.orders ADD CONSTRAINT orders_expected_duration_days_check 
  CHECK (expected_duration_days IS NULL OR (expected_duration_days >= 0.25 AND expected_duration_days <= 30));

-- Also ensure the user_can_view_order function properly handles admin users
-- Update the function to be more robust
CREATE OR REPLACE FUNCTION public.user_can_view_order(order_uuid uuid, user_uuid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  -- Handle null user_uuid
  IF user_uuid IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user is admin first (priority check)
  IF public.is_admin(user_uuid) THEN
    RETURN true;
  END IF;
  
  -- Check if user owns the client for this order
  IF EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON o.client_id = c.id
    WHERE o.id = order_uuid 
    AND c.user_id = user_uuid
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is an engineer assigned to this order
  IF EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.engineers e ON o.engineer_id = e.id
    WHERE o.id = order_uuid 
    AND e.user_id = user_uuid
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$function$