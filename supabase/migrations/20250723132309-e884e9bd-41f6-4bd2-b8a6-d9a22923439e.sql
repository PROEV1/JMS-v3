-- Create a table to track lead status changes locally
CREATE TABLE public.lead_status_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_lead_id text NOT NULL UNIQUE,
  status text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text
);

-- Enable RLS
ALTER TABLE public.lead_status_overrides ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage lead status overrides
CREATE POLICY "Admins can manage lead status overrides"
ON public.lead_status_overrides
FOR ALL
USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- Policy for users to view lead status overrides
CREATE POLICY "Users can view lead status overrides"
ON public.lead_status_overrides
FOR SELECT
USING (true);

-- Create an index for better performance
CREATE INDEX idx_lead_status_overrides_external_lead_id ON public.lead_status_overrides(external_lead_id);