-- Create an admin user profile for testing
-- First, let's check if there's an admin user already
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Look for existing admin
    SELECT user_id INTO admin_user_id FROM profiles WHERE role = 'admin' LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        -- Create a test admin user profile
        -- Note: You'll need to create the actual auth user separately in Supabase Auth
        INSERT INTO profiles (
            id,
            user_id,
            email,
            full_name,
            role,
            status,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'test-admin-user-id'::uuid, -- Replace this with actual user_id from auth.users
            'admin@test.com',
            'Test Admin',
            'admin',
            'active',
            now(),
            now()
        );
    END IF;
END $$;