-- Create function to check user permissions
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id UUID, permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_permissions up
    JOIN profiles p ON p.role = up.role
    WHERE p.user_id = user_has_permission.user_id 
    AND up.permission_key = user_has_permission.permission_key 
    AND up.can_access = true
    AND p.status = 'active'
  );
$$;

-- Create function to get user's assigned jobs count
CREATE OR REPLACE FUNCTION public.get_user_assigned_jobs_count(user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM orders o
  JOIN engineers e ON e.id = o.engineer_id
  WHERE e.user_id = get_user_assigned_jobs_count.user_id;
$$;

-- Create audit log table for user management actions
CREATE TABLE IF NOT EXISTS user_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,
    target_user_id UUID,
    performed_by UUID NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE user_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON user_audit_log
FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'manager'));

-- Function to log user management actions
CREATE OR REPLACE FUNCTION public.log_user_action(
    p_action_type TEXT,
    p_target_user_id UUID,
    p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO user_audit_log (action_type, target_user_id, performed_by, details)
    VALUES (p_action_type, p_target_user_id, auth.uid(), p_details)
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;