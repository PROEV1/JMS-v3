-- Create product compatibility table for linking core products to accessories
CREATE TABLE public.product_compatibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  core_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  accessory_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(core_product_id, accessory_product_id)
);

-- Enable RLS
ALTER TABLE public.product_compatibility ENABLE ROW LEVEL SECURITY;

-- Create policies for product compatibility
CREATE POLICY "Everyone can view product compatibility" 
ON public.product_compatibility 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage product compatibility" 
ON public.product_compatibility 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- Update existing product categories to Core and Accessories
-- First, let's update common core products
UPDATE public.products 
SET category = 'Core' 
WHERE category IN ('Kitchen Units', 'Bathroom Units', 'Wardrobes', 'Storage Units', 'Bedroom Units', 'Office Units');

-- Update accessory-type products
UPDATE public.products 
SET category = 'Accessories' 
WHERE category IN ('Hardware', 'Accessories', 'Fittings') 
   OR name ILIKE '%drawer%' 
   OR name ILIKE '%rail%' 
   OR name ILIKE '%pull%' 
   OR name ILIKE '%handle%'
   OR name ILIKE '%hinge%';

-- Set any remaining products to Core as default
UPDATE public.products 
SET category = 'Core' 
WHERE category IS NULL OR category NOT IN ('Core', 'Accessories');