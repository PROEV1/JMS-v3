-- Fix the conflicting log_user_action function
-- Drop the existing functions and recreate with proper overloads
DROP FUNCTION IF EXISTS public.log_user_action(text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.log_user_action(text, uuid, jsonb, uuid);

-- Recreate the function with proper parameter handling
CREATE OR REPLACE FUNCTION public.log_user_action(
  p_action_type text, 
  p_target_user_id uuid, 
  p_details jsonb DEFAULT '{}'::jsonb, 
  p_performed_by uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO user_audit_log (action_type, target_user_id, performed_by, details)
  VALUES (
    p_action_type,
    p_target_user_id,
    COALESCE(p_performed_by, auth.uid(), p_target_user_id),
    p_details
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;