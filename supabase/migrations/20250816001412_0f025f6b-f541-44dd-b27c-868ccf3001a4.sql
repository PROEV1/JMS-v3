-- Add postcode column to clients table
ALTER TABLE public.clients 
ADD COLUMN postcode text;