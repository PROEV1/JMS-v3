
-- 1) Extend engineers with subcontractor flags (backward-compatible)
ALTER TABLE public.engineers
  ADD COLUMN IF NOT EXISTS is_subcontractor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignore_working_hours boolean NOT NULL DEFAULT false;

-- 2) Audit table for engineer capacity/scheduling rule changes
CREATE TABLE IF NOT EXISTS public.engineer_capacity_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id uuid NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  changed_by uuid NULL,
  changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.engineer_capacity_audit ENABLE ROW LEVEL SECURITY;

-- Allow admins to read audit logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'engineer_capacity_audit' AND policyname = 'Admins can view engineer capacity audit'
  ) THEN
    CREATE POLICY "Admins can view engineer capacity audit"
      ON public.engineer_capacity_audit
      FOR SELECT
      USING (is_admin());
  END IF;
END$$;

-- Create SECURITY DEFINER trigger function to insert audit rows bypassing RLS
CREATE OR REPLACE FUNCTION public.fn_engineer_capacity_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
BEGIN
  -- Only log if relevant fields changed
  IF NEW.is_subcontractor IS DISTINCT FROM OLD.is_subcontractor THEN
    v_changes := v_changes || jsonb_build_object('is_subcontractor', jsonb_build_object('old', OLD.is_subcontractor, 'new', NEW.is_subcontractor));
  END IF;

  IF NEW.ignore_working_hours IS DISTINCT FROM OLD.ignore_working_hours THEN
    v_changes := v_changes || jsonb_build_object('ignore_working_hours', jsonb_build_object('old', OLD.ignore_working_hours, 'new', NEW.ignore_working_hours));
  END IF;

  IF NEW.max_installs_per_day IS DISTINCT FROM OLD.max_installs_per_day THEN
    v_changes := v_changes || jsonb_build_object('max_installs_per_day', jsonb_build_object('old', OLD.max_installs_per_day, 'new', NEW.max_installs_per_day));
  END IF;

  IF NEW.availability IS DISTINCT FROM OLD.availability THEN
    v_changes := v_changes || jsonb_build_object('availability', jsonb_build_object('old', OLD.availability, 'new', NEW.availability));
  END IF;

  IF v_changes = '{}'::jsonb THEN
    RETURN NEW; -- nothing to log
  END IF;

  INSERT INTO public.engineer_capacity_audit (engineer_id, changed_by, changes)
  VALUES (NEW.id, auth.uid(), v_changes);

  RETURN NEW;
END;
$$;

-- Attach trigger to engineers table
DROP TRIGGER IF EXISTS trg_engineer_capacity_audit ON public.engineers;

CREATE TRIGGER trg_engineer_capacity_audit
AFTER UPDATE ON public.engineers
FOR EACH ROW
EXECUTE FUNCTION public.fn_engineer_capacity_audit();

-- 3) Upsert subcontractor feature flag in admin_settings (safe default disabled)
INSERT INTO public.admin_settings (setting_key, setting_value)
VALUES ('subcontractor_settings', jsonb_build_object('enabled', false, 'alert_threshold_percent', 80))
ON CONFLICT (setting_key)
DO UPDATE SET setting_value = COALESCE(
  public.admin_settings.setting_value || jsonb_build_object(
    'enabled', (public.admin_settings.setting_value->>'enabled')::boolean,
    'alert_threshold_percent', COALESCE((public.admin_settings.setting_value->>'alert_threshold_percent')::int, 80)
  ),
  jsonb_build_object('enabled', false, 'alert_threshold_percent', 80)
), updated_at = now();
