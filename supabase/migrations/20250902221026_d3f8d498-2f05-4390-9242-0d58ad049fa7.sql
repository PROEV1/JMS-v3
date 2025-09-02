-- Add skipped_details column to partner_import_logs
ALTER TABLE public.partner_import_logs 
ADD COLUMN IF NOT EXISTS skipped_details JSONB DEFAULT '[]'::jsonb;

-- Update the log_partner_import function to accept skipped_details
CREATE OR REPLACE FUNCTION public.log_partner_import(
  p_run_id text, 
  p_partner_id uuid, 
  p_profile_id uuid, 
  p_dry_run boolean, 
  p_total_rows integer, 
  p_inserted_count integer, 
  p_updated_count integer, 
  p_skipped_count integer, 
  p_warnings jsonb DEFAULT '[]'::jsonb, 
  p_errors jsonb DEFAULT '[]'::jsonb,
  p_skipped_details jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  insert into public.partner_import_logs (
    run_id, partner_id, profile_id, dry_run, total_rows,
    inserted_count, updated_count, skipped_count, warnings, errors, skipped_details, created_by
  ) values (
    p_run_id, p_partner_id, p_profile_id, p_dry_run, p_total_rows,
    p_inserted_count, p_updated_count, p_skipped_count, p_warnings, p_errors, p_skipped_details, auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$function$;