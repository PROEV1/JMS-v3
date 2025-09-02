-- Add unique constraint for email_normalized on clients table
ALTER TABLE public.clients 
ADD CONSTRAINT clients_email_normalized_key UNIQUE (email_normalized);

-- Add unique constraint for partner_id + partner_external_id on orders table  
ALTER TABLE public.orders 
ADD CONSTRAINT orders_partner_external_id_key UNIQUE (partner_id, partner_external_id);