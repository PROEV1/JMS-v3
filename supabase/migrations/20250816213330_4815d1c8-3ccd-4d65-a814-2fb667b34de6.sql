-- Create missing profiles and engineer records for imported users
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Process each user that has no engineer record
    FOR user_record IN 
        SELECT u.id as user_id, u.email, u.raw_user_meta_data->>'full_name' as full_name
        FROM auth.users u
        LEFT JOIN engineers e ON u.id = e.user_id  
        WHERE e.id IS NULL 
        AND u.email LIKE 'eng%@example.com'
    LOOP
        -- Create profile first
        INSERT INTO profiles (user_id, email, full_name, role, status)
        VALUES (
            user_record.user_id,
            user_record.email,
            COALESCE(user_record.full_name, split_part(user_record.email, '@', 1)),
            'engineer'::user_role,
            'active'
        )
        ON CONFLICT (user_id) DO UPDATE SET
            role = 'engineer'::user_role,
            status = 'active',
            full_name = COALESCE(profiles.full_name, COALESCE(user_record.full_name, split_part(user_record.email, '@', 1))),
            email = COALESCE(profiles.email, user_record.email);
        
        -- Create engineer record
        INSERT INTO engineers (user_id, name, email, availability, region)
        VALUES (
            user_record.user_id,
            COALESCE(user_record.full_name, split_part(user_record.email, '@', 1)),
            user_record.email,
            true,
            'Not set'
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Created engineer and profile for: %', user_record.email;
    END LOOP;
    
    RAISE NOTICE 'Completed creating missing engineers and profiles';
END $$;