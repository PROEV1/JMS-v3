-- Expand user roles to include manager and standard_office_user
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'standard_office_user';

-- Add status, region, and last_login to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invite_token TEXT;

-- Create user permissions framework
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role user_role NOT NULL,
    permission_key TEXT NOT NULL,
    can_access BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(role, permission_key)
);

-- Enable RLS on user_permissions
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policy for user_permissions
CREATE POLICY "Admins can manage user permissions" ON user_permissions
FOR ALL USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can view permissions" ON user_permissions
FOR SELECT USING (true);

-- Insert default permissions for each role
INSERT INTO user_permissions (role, permission_key, can_access) VALUES
-- Admin permissions (full access)
('admin', 'users.manage', true),
('admin', 'users.create', true),
('admin', 'users.delete', true),
('admin', 'quotes.manage', true),
('admin', 'orders.manage', true),
('admin', 'clients.manage', true),
('admin', 'messages.manage', true),
('admin', 'engineers.manage', true),
('admin', 'settings.manage', true),
('admin', 'reports.financial', true),

-- Manager permissions (everything except user management)
('manager', 'users.manage', false),
('manager', 'users.create', false),
('manager', 'users.delete', false),
('manager', 'quotes.manage', true),
('manager', 'orders.manage', true),
('manager', 'clients.manage', true),
('manager', 'messages.manage', true),
('manager', 'engineers.manage', true),
('manager', 'settings.manage', true),
('manager', 'reports.financial', true),

-- Standard office user permissions (limited access)
('standard_office_user', 'users.manage', false),
('standard_office_user', 'users.create', false),
('standard_office_user', 'users.delete', false),
('standard_office_user', 'quotes.manage', true),
('standard_office_user', 'orders.manage', true),
('standard_office_user', 'clients.manage', true),
('standard_office_user', 'messages.manage', true),
('standard_office_user', 'engineers.manage', false),
('standard_office_user', 'settings.manage', false),
('standard_office_user', 'reports.financial', false),

-- Engineer permissions (job-focused only)
('engineer', 'users.manage', false),
('engineer', 'users.create', false),
('engineer', 'users.delete', false),
('engineer', 'quotes.manage', false),
('engineer', 'orders.manage', false),
('engineer', 'clients.manage', false),
('engineer', 'messages.manage', false),
('engineer', 'engineers.manage', false),
('engineer', 'settings.manage', false),
('engineer', 'reports.financial', false),
('engineer', 'jobs.assigned', true),
('engineer', 'jobs.upload', true),
('engineer', 'jobs.complete', true),

-- Client permissions (view only their own data)
('client', 'users.manage', false),
('client', 'users.create', false),
('client', 'users.delete', false),
('client', 'quotes.view_own', true),
('client', 'orders.view_own', true),
('client', 'messages.view_own', true)
ON CONFLICT (role, permission_key) DO NOTHING;

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

-- Update profiles RLS policies to include status check
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
FOR SELECT USING (auth.uid() = user_id AND status = 'active');

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