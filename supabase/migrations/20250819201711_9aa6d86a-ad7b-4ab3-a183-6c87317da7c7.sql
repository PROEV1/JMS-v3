
-- 1) Indexes for common filters used by imports and deletions

-- Orders: partner lookups and flags
CREATE INDEX IF NOT EXISTS idx_orders_partner_comp
  ON public.orders (partner_id, partner_external_id);

CREATE INDEX IF NOT EXISTS idx_orders_partner_flag
  ON public.orders (is_partner_job, partner_id);

-- Orders: import run id from JSONB metadata
CREATE INDEX IF NOT EXISTS idx_orders_import_run_id
  ON public.orders ((partner_metadata->>'import_run_id'));

-- Orders: client and engineer relationships
CREATE INDEX IF NOT EXISTS idx_orders_client_id
  ON public.orders (client_id);

CREATE INDEX IF NOT EXISTS idx_orders_engineer_id
  ON public.orders (engineer_id);

-- Dependents filtered by order_id during deletions
CREATE INDEX IF NOT EXISTS idx_job_offers_order_id
  ON public.job_offers (order_id);

CREATE INDEX IF NOT EXISTS idx_order_activity_order_id
  ON public.order_activity (order_id);

CREATE INDEX IF NOT EXISTS idx_order_completion_checklist_order_id
  ON public.order_completion_checklist (order_id);

CREATE INDEX IF NOT EXISTS idx_engineer_uploads_order_id
  ON public.engineer_uploads (order_id);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id
  ON public.order_payments (order_id);

-- Quotes filtered by client
CREATE INDEX IF NOT EXISTS idx_quotes_client_id
  ON public.quotes (client_id);

-- Case-insensitive email lookups
CREATE INDEX IF NOT EXISTS idx_clients_email_lower
  ON public.clients ((lower(email)));

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles ((lower(email)));



-- 2) Make audit logging robust in service-role contexts
-- Add an optional p_performed_by and ensure non-null performed_by.
CREATE OR REPLACE FUNCTION public.log_user_action(
  p_action_type text,
  p_target_user_id uuid,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_performed_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO user_audit_log (action_type, target_user_id, performed_by, details)
  VALUES (
    p_action_type,
    p_target_user_id,
    COALESCE(p_performed_by, auth.uid(), p_target_user_id),
    p_details
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$function$;
