-- Check and fix engineers without proper profiles
-- First, let's see what we have
DO $$
DECLARE
    engineer_record RECORD;
    profile_exists BOOLEAN;
BEGIN
    -- Create profiles for engineers that don't have them
    FOR engineer_record IN 
        SELECT e.id, e.user_id, e.email, e.name 
        FROM engineers e 
        WHERE e.user_id IS NOT NULL
    LOOP
        -- Check if profile exists
        SELECT EXISTS(
            SELECT 1 FROM profiles 
            WHERE user_id = engineer_record.user_id
        ) INTO profile_exists;
        
        -- If no profile exists, create one
        IF NOT profile_exists THEN
            INSERT INTO profiles (user_id, email, full_name, role, status)
            VALUES (
                engineer_record.user_id,
                engineer_record.email,
                engineer_record.name,
                'engineer'::user_role,
                'active'
            )
            ON CONFLICT (user_id) DO UPDATE SET
                role = 'engineer'::user_role,
                status = 'active',
                full_name = COALESCE(profiles.full_name, engineer_record.name),
                email = COALESCE(profiles.email, engineer_record.email);
        ELSE
            -- Update existing profile to ensure it has engineer role
            UPDATE profiles 
            SET 
                role = 'engineer'::user_role,
                status = 'active',
                full_name = COALESCE(full_name, engineer_record.name),
                email = COALESCE(email, engineer_record.email)
            WHERE user_id = engineer_record.user_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed profile sync for engineers';
END $$;