-- Add a simple test function to verify edge function connectivity
CREATE OR REPLACE FUNCTION public.test_partner_import_connectivity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Database connectivity test passed',
    'timestamp', now()
  );
END;
$$;