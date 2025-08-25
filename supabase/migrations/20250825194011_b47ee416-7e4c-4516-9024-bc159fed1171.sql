-- Update Darren Cope to admin role
UPDATE profiles 
SET role = 'admin', 
    status = 'active',
    updated_at = now()
WHERE email = 'darren.cope@proev.co.uk';

-- Ensure proper RLS policies for profiles table that allow admin access
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" 
ON profiles 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'active'
  )
);

-- Ensure users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" 
ON profiles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Ensure users can update their own profile (limited fields)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
ON profiles 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() 
  AND role = OLD.role -- Can't change their own role
);

-- Fix user permissions view permissions
DROP POLICY IF EXISTS "Admins can view user permissions" ON user_permissions;
CREATE POLICY "Admins can view user permissions" 
ON user_permissions 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'active'
  )
);