-- Add new fields to lead_history table to match the enhanced lead data
ALTER TABLE public.lead_history 
ADD COLUMN IF NOT EXISTS total_price numeric,
ADD COLUMN IF NOT EXISTS accessories_data jsonb,
ADD COLUMN IF NOT EXISTS finish text,
ADD COLUMN IF NOT EXISTS luxe_upgrade boolean;