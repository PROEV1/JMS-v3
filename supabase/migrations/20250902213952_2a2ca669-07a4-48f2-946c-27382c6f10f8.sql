-- Ensure RLS is enabled for partner_import_logs table and add admin policy if not exists
ALTER TABLE IF EXISTS public.partner_import_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins to read all import logs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'partner_import_logs' 
        AND policyname = 'Admins can read all import logs'
    ) THEN
        CREATE POLICY "Admins can read all import logs" ON public.partner_import_logs
            FOR SELECT USING (is_admin());
    END IF;
END
$$;