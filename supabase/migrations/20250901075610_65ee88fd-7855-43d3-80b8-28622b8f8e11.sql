-- Create partner_quote_settings table for SLA and file requirements
CREATE TABLE IF NOT EXISTS public.partner_quote_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  sla_hours INTEGER NOT NULL DEFAULT 48 CHECK (sla_hours >= 1 AND sla_hours <= 168),
  require_file BOOLEAN NOT NULL DEFAULT true,
  auto_hide_days INTEGER NOT NULL DEFAULT 30 CHECK (auto_hide_days >= 1 AND auto_hide_days <= 365),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(partner_id)
);

-- Enable RLS
ALTER TABLE public.partner_quote_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage partner quote settings" 
ON public.partner_quote_settings 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Partners can view their own quote settings"
ON public.partner_quote_settings
FOR SELECT
USING (can_access_partner_data(auth.uid(), partner_id));

-- Add index for partner lookups
CREATE INDEX idx_partner_quote_settings_partner_id 
ON public.partner_quote_settings(partner_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_partner_quote_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_partner_quote_settings_updated_at
BEFORE UPDATE ON public.partner_quote_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_partner_quote_settings_updated_at();