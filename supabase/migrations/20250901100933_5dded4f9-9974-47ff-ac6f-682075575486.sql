
-- 1) Enum for override types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_quote_override_type') THEN
    CREATE TYPE public.partner_quote_override_type AS ENUM (
      'quoted_pending_approval',
      'standard_quote_marked'
    );
  END IF;
END $$;

-- 2) Partner quote overrides table (admin-only)
CREATE TABLE IF NOT EXISTS public.partner_quote_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  override_type public.partner_quote_override_type NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleared_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_quote_overrides_order_id ON public.partner_quote_overrides(order_id);

-- Enable RLS and admin-only access
ALTER TABLE public.partner_quote_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage partner_quote_overrides" ON public.partner_quote_overrides;
CREATE POLICY "Admins manage partner_quote_overrides"
  ON public.partner_quote_overrides
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- 3) Trigger: when a STANDARD quote is marked (and not cleared),
--    push the order to Needs Scheduling immediately
CREATE OR REPLACE FUNCTION public.apply_partner_quote_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only act on insert or when updating the cleared_at back to NULL with same type
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.cleared_at IS NULL) THEN
    IF NEW.override_type = 'standard_quote_marked' THEN
      -- Fast-track to Needs Scheduling: lift suppression and set manual status
      UPDATE public.orders
      SET
        scheduling_suppressed = false,
        manual_status_override = true,
        manual_status_notes = 'Auto-set by standard quote mark (partner_quote_overrides)',
        status_enhanced = 'awaiting_install_booking'::order_status_enhanced,
        updated_at = now()
      WHERE id = NEW.order_id;
    ELSIF NEW.override_type = 'quoted_pending_approval' THEN
      -- Keep this job out of scheduling while in approval flow
      UPDATE public.orders
      SET
        scheduling_suppressed = true,
        updated_at = now()
      WHERE id = NEW.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_partner_quote_override ON public.partner_quote_overrides;
CREATE TRIGGER trg_apply_partner_quote_override
AFTER INSERT OR UPDATE ON public.partner_quote_overrides
FOR EACH ROW
EXECUTE FUNCTION public.apply_partner_quote_override();
