-- Add unique constraints for idempotent partner imports
ALTER TABLE public.orders ADD CONSTRAINT unique_partner_job_id 
UNIQUE (partner_id, partner_external_id) DEFERRABLE INITIALLY DEFERRED;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_partner_id ON public.orders(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_partner_external_id ON public.orders(partner_external_id) WHERE partner_external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_is_partner_job ON public.orders(is_partner_job) WHERE is_partner_job = true;

-- Add partner engineer mapping table
CREATE TABLE IF NOT EXISTS public.partner_engineer_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  partner_engineer_name TEXT NOT NULL,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(partner_id, partner_engineer_name)
);

-- Enable RLS on partner engineer mappings
ALTER TABLE public.partner_engineer_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for partner engineer mappings
CREATE POLICY "Admins can manage partner engineer mappings" 
ON public.partner_engineer_mappings 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role)
WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Managers can view partner engineer mappings" 
ON public.partner_engineer_mappings 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'manager'::user_role]));

-- Add updated_at trigger
CREATE TRIGGER update_partner_engineer_mappings_updated_at
  BEFORE UPDATE ON public.partner_engineer_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add calendar blocking status enum if not exists
DO $$ BEGIN
  CREATE TYPE partner_calendar_status AS ENUM ('available', 'soft_hold', 'confirmed', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add partner calendar blocking tracking
CREATE TABLE IF NOT EXISTS public.partner_calendar_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  time_slot TEXT, -- e.g., 'morning', 'afternoon', 'full_day'
  block_status partner_calendar_status NOT NULL DEFAULT 'confirmed',
  partner_job_id TEXT, -- Reference to partner's job ID
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(partner_id, engineer_id, blocked_date, time_slot)
);

-- Enable RLS
ALTER TABLE public.partner_calendar_blocks ENABLE ROW LEVEL SECURITY;

-- Policies for calendar blocks
CREATE POLICY "Admins can manage partner calendar blocks" 
ON public.partner_calendar_blocks 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role)
WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Engineers can view blocks for their schedule" 
ON public.partner_calendar_blocks 
FOR SELECT 
USING (engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_partner_calendar_blocks_updated_at
  BEFORE UPDATE ON public.partner_calendar_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();