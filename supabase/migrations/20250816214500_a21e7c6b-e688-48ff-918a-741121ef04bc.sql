-- Fix missing engineer records and correct profiles (without ON CONFLICT)
DO $$
DECLARE
    user_record RECORD;
    engineer_exists BOOLEAN;
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
        
        -- Check if engineer record already exists
        SELECT EXISTS(SELECT 1 FROM engineers WHERE user_id = user_record.user_id) INTO engineer_exists;
        
        -- Create engineer record if it doesn't exist
        IF NOT engineer_exists THEN
            INSERT INTO engineers (user_id, name, email, availability, region)
            VALUES (
                user_record.user_id,
                COALESCE(user_record.full_name, split_part(user_record.email, '@', 1)),
                user_record.email,
                true,
                'Not set'
            );
            
            RAISE NOTICE 'Created engineer record for: %', user_record.email;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed creating missing engineer records';
END $$;