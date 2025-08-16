-- Fix missing engineer records and correct profiles
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- First, get all engineer users and create missing records
    FOR user_record IN 
        SELECT u.id as user_id, u.email, u.raw_user_meta_data->>'full_name' as full_name
        FROM auth.users u
        WHERE u.email LIKE 'eng%@example.com'
    LOOP
        -- Update profile to engineer role
        UPDATE profiles 
        SET role = 'engineer'::user_role,
            status = 'active'
        WHERE user_id = user_record.user_id;
        
        -- Create engineer record if it doesn't exist
        INSERT INTO engineers (user_id, name, email, availability, region)
        VALUES (
            user_record.user_id,
            COALESCE(user_record.full_name, split_part(user_record.email, '@', 1)),
            user_record.email,
            true,
            'Not set'
        )
        ON CONFLICT (user_id) DO NOTHING;
        
        RAISE NOTICE 'Created engineer record for: %', user_record.email;
    END LOOP;
    
    RAISE NOTICE 'Completed creating missing engineer records';
END $$;