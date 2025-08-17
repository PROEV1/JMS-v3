-- Drop and recreate get_user_role function to prevent recursion
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS user_role AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.profiles 
    WHERE user_id = user_uuid 
    AND status = 'active'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update the user_has_permission function to avoid recursion
DROP FUNCTION IF EXISTS public.user_has_permission(uuid, text);

CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid uuid, permission_key text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_permissions up
    JOIN profiles p ON p.role = up.role
    WHERE p.user_id = user_uuid
      AND up.permission_key = permission_key
      AND up.can_access = true
      AND p.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;