
-- 1) Enum for partner quote statuses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_quote_status') THEN
    CREATE TYPE public.partner_quote_status AS ENUM ('submitted','approved','rejected','rework','withdrawn');
  END IF;
END$$;

-- 2) Settings table per partner
CREATE TABLE IF NOT EXISTS public.partner_quote_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sla_hours INTEGER NOT NULL DEFAULT 48,
  auto_hide_days INTEGER NOT NULL DEFAULT 14,
  require_file BOOLEAN NOT NULL DEFAULT true,
  notifications JSONB NOT NULL DEFAULT jsonb_build_object(
    'digest', true,
    'sla_breach', true,
    'decision_alerts', true
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id)
);

ALTER TABLE public.partner_quote_settings ENABLE ROW LEVEL SECURITY;

-- Admin/Manager can manage settings
DROP POLICY IF EXISTS "Partner quote settings admin manage" ON public.partner_quote_settings;
CREATE POLICY "Partner quote settings admin manage"
  ON public.partner_quote_settings
  FOR ALL
  TO authenticated
  USING (is_admin() OR is_manager())
  WITH CHECK (is_admin() OR is_manager());

-- Everyone authenticated can read settings
DROP POLICY IF EXISTS "Partner quote settings read" ON public.partner_quote_settings;
CREATE POLICY "Partner quote settings read"
  ON public.partner_quote_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_partner_quote_settings_partner ON public.partner_quote_settings (partner_id);

-- 3) Partner quotes table
CREATE TABLE IF NOT EXISTS public.partner_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  notes TEXT,
  file_url TEXT,
  storage_bucket TEXT,
  storage_path TEXT,
  submitted_by UUID DEFAULT auth.uid(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.partner_quote_status NOT NULL DEFAULT 'submitted',
  decision_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_quotes ENABLE ROW LEVEL SECURITY;

-- Admin/Manager full control
DROP POLICY IF EXISTS "Partner quotes admin manage" ON public.partner_quotes;
CREATE POLICY "Partner quotes admin manage"
  ON public.partner_quotes
  FOR ALL
  TO authenticated
  USING (is_admin() OR is_manager())
  WITH CHECK (is_admin() OR is_manager());

-- Authenticated users can read (read-only for now)
DROP POLICY IF EXISTS "Partner quotes read" ON public.partner_quotes;
CREATE POLICY "Partner quotes read"
  ON public.partner_quotes
  FOR SELECT
  TO authenticated
  USING (true);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_partner_quotes_order ON public.partner_quotes (order_id);
CREATE INDEX IF NOT EXISTS idx_partner_quotes_partner ON public.partner_quotes (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_quotes_status ON public.partner_quotes (status);
CREATE INDEX IF NOT EXISTS idx_partner_quotes_submitted_at ON public.partner_quotes (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_quotes_order_submitted_at ON public.partner_quotes (order_id, submitted_at DESC);

-- 4) View for latest quote per order
CREATE OR REPLACE VIEW public.partner_quotes_latest AS
SELECT DISTINCT ON (pq.order_id)
  pq.id,
  pq.order_id,
  pq.partner_id,
  pq.amount,
  pq.currency,
  pq.notes,
  pq.file_url,
  pq.storage_bucket,
  pq.storage_path,
  pq.submitted_by,
  pq.submitted_at,
  pq.status,
  pq.decision_at,
  pq.decision_notes,
  pq.created_at,
  pq.updated_at
FROM public.partner_quotes pq
ORDER BY pq.order_id, pq.submitted_at DESC, pq.created_at DESC;

-- Secure the view (inherits underlying RLS)
GRANT SELECT ON public.partner_quotes_latest TO authenticated;

