-- Add part_details column to orders table
ALTER TABLE public.orders 
ADD COLUMN part_details TEXT;

-- Add part_details column to quotes table  
ALTER TABLE public.quotes
ADD COLUMN part_details TEXT;

-- Add comment to describe the fields
COMMENT ON COLUMN public.orders.part_details IS 'Description of specific parts needed when part_required is true';
COMMENT ON COLUMN public.quotes.part_details IS 'Description of specific parts needed when part_required is true';