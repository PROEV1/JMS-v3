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