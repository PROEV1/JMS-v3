-- Add columns to support partner client imports
ALTER TABLE public.clients 
ADD COLUMN is_partner_client boolean DEFAULT false,
ADD COLUMN partner_id uuid REFERENCES public.partners(id);

-- Add index for performance
CREATE INDEX idx_clients_partner_id ON public.clients(partner_id);
CREATE INDEX idx_clients_is_partner_client ON public.clients(is_partner_client);