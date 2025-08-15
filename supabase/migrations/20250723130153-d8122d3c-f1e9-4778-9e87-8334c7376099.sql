
-- Create a lead_history table to preserve all lead data when converting to clients
CREATE TABLE public.lead_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  original_lead_id text NOT NULL,
  lead_name text NOT NULL,
  lead_email text NOT NULL,
  lead_phone text,
  lead_notes text,
  product_name text,
  product_price numeric,
  width_cm numeric,
  lead_created_at timestamp with time zone NOT NULL,
  converted_at timestamp with time zone NOT NULL DEFAULT now(),
  source text,
  status text
);

-- Add RLS policies for lead_history
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;

-- Policy for clients to view their own lead history
CREATE POLICY "Clients can view their own lead history"
ON public.lead_history
FOR SELECT
USING (client_id IN (
  SELECT id FROM public.clients WHERE user_id = auth.uid()
));

-- Policy for admins to manage all lead history
CREATE POLICY "Admins can manage all lead history"
ON public.lead_history
FOR ALL
USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- Create an index for better performance
CREATE INDEX idx_lead_history_client_id ON public.lead_history(client_id);
