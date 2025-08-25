-- Add quote_id column to leads table to track converted quotes
ALTER TABLE public.leads 
ADD COLUMN quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL;