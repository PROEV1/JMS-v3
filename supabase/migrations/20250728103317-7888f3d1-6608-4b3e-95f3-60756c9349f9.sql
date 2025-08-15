-- Add min_width column to products table for core products
ALTER TABLE public.products 
ADD COLUMN min_width NUMERIC(10,2) NULL;

-- Add a comment to clarify this field is for core products
COMMENT ON COLUMN public.products.min_width IS 'Minimum width requirement in centimeters (applies to core products only)';