
-- 1) Create leads table to replace external source

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- basic contact
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,

  -- status workflow (keep as text to avoid enum churn)
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','qualified','converted','unqualified','closed')),

  -- associations
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by UUID,  -- storing auth.uid() from app; no FK to auth schema by design

  -- meta
  source TEXT,
  notes TEXT,
  quote_number TEXT,

  -- optional product / pricing details (already used in UI)
  total_cost NUMERIC,
  total_price NUMERIC,
  product_details TEXT,
  product_name TEXT,
  product_price NUMERIC,
  width_cm NUMERIC,
  finish TEXT,
  luxe_upgrade BOOLEAN,
  accessories_data JSONB DEFAULT '[]'::jsonb,
  configuration JSONB DEFAULT '{}'::jsonb,

  -- timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Trigger to maintain updated_at
DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON public.leads (client_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads (email);

-- 4) RLS: admins/managers manage everything; clients can read their own
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'leads' AND policyname = 'Admins and managers can manage leads'
  ) THEN
    CREATE POLICY "Admins and managers can manage leads"
      ON public.leads
      FOR ALL
      USING (get_user_role(auth.uid()) IN ('admin'::user_role, 'manager'::user_role))
      WITH CHECK (get_user_role(auth.uid()) IN ('admin'::user_role, 'manager'::user_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'leads' AND policyname = 'Clients can view their own leads'
  ) THEN
    CREATE POLICY "Clients can view their own leads"
      ON public.leads
      FOR SELECT
      USING (
        client_id IN (
          SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid()
        )
      );
  END IF;
END$$;
