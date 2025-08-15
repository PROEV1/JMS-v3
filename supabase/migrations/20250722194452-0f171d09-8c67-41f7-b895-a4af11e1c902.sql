
-- Create products table for managing product catalog
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  specifications JSONB DEFAULT '{}',
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product images table for storing multiple images per product
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  image_name TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product configurations table for width, finish, and other options
CREATE TABLE public.product_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  configuration_type TEXT NOT NULL, -- 'width', 'finish', 'style', etc.
  option_name TEXT NOT NULL,
  option_value TEXT NOT NULL,
  price_modifier DECIMAL(10,2) DEFAULT 0, -- Additional cost for this option
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quote items table for detailed quote breakdown
CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  configuration JSONB DEFAULT '{}', -- Store selected options
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new columns to existing quotes table for enhanced functionality
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS quote_template TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS includes_installation BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS warranty_period TEXT DEFAULT '5 years',
ADD COLUMN IF NOT EXISTS special_instructions TEXT,
ADD COLUMN IF NOT EXISTS is_shareable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Enable RLS on new tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Create policies for products (admins can manage, everyone can view active products)
CREATE POLICY "Admins can manage all products" 
ON public.products 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Everyone can view active products" 
ON public.products 
FOR SELECT 
USING (is_active = true);

-- Create policies for product images
CREATE POLICY "Admins can manage product images" 
ON public.product_images 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Everyone can view product images" 
ON public.product_images 
FOR SELECT 
USING (product_id IN (SELECT id FROM public.products WHERE is_active = true));

-- Create policies for product configurations
CREATE POLICY "Admins can manage product configurations" 
ON public.product_configurations 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Everyone can view product configurations" 
ON public.product_configurations 
FOR SELECT 
USING (product_id IN (SELECT id FROM public.products WHERE is_active = true));

-- Create policies for quote items
CREATE POLICY "Clients can view their own quote items" 
ON public.quote_items 
FOR SELECT 
USING (quote_id IN (
  SELECT q.id FROM public.quotes q 
  JOIN public.clients c ON q.client_id = c.id 
  WHERE c.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all quote items" 
ON public.quote_items 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- Create triggers for updated_at columns
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for product images if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for product images
CREATE POLICY "Public can view product images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'product-images' AND get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Admins can update product images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'product-images' AND get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Admins can delete product images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'product-images' AND get_user_role(auth.uid()) = 'admin'::user_role);

-- Function to generate share tokens for quotes
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_shareable = true AND NEW.share_token IS NULL THEN
    NEW.share_token := encode(gen_random_bytes(32), 'base64url');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for share token generation
CREATE TRIGGER generate_share_token_trigger
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_share_token();
