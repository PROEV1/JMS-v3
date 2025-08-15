-- Add engineer role to existing user_role enum
ALTER TYPE user_role ADD VALUE 'engineer';

-- Create engineers table
CREATE TABLE public.engineers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  region TEXT,
  availability BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on engineers table
ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

-- Engineers can view their own data
CREATE POLICY "Engineers can view their own data" 
ON public.engineers 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admins can manage all engineers
CREATE POLICY "Admins can manage all engineers" 
ON public.engineers 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin');

-- Add engineer assignment fields to orders table
ALTER TABLE public.orders 
ADD COLUMN engineer_id UUID REFERENCES public.engineers(id),
ADD COLUMN scheduled_install_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN engineer_notes TEXT,
ADD COLUMN engineer_signed_off_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN engineer_signature_data TEXT,
ADD COLUMN admin_qa_notes TEXT;

-- Create engineer_uploads table for installation images
CREATE TABLE public.engineer_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id),
  upload_type TEXT NOT NULL, -- 'pre_install', 'frame_fitted', 'drawers_in_place', 'final_install', 'push_mechanism', 'issues'
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on engineer_uploads
ALTER TABLE public.engineer_uploads ENABLE ROW LEVEL SECURITY;

-- Engineers can manage their own uploads
CREATE POLICY "Engineers can manage their own uploads" 
ON public.engineer_uploads 
FOR ALL 
USING (engineer_id IN (
  SELECT id FROM public.engineers WHERE user_id = auth.uid()
));

-- Admins can view all uploads
CREATE POLICY "Admins can view all engineer uploads" 
ON public.engineer_uploads 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'admin');

-- Clients can view uploads for their orders
CREATE POLICY "Clients can view uploads for their orders" 
ON public.engineer_uploads 
FOR SELECT 
USING (order_id IN (
  SELECT id FROM public.orders 
  WHERE client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
));

-- Add trigger for updated_at on engineers
CREATE TRIGGER update_engineers_updated_at
  BEFORE UPDATE ON public.engineers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for engineer uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('engineer-uploads', 'engineer-uploads', true);

-- Storage policies for engineer uploads
CREATE POLICY "Engineers can upload their files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'engineer-uploads' AND 
  auth.uid() IN (SELECT user_id FROM public.engineers)
);

CREATE POLICY "Engineers can view their files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'engineer-uploads' AND 
  auth.uid() IN (SELECT user_id FROM public.engineers)
);

CREATE POLICY "Admins can manage all engineer files" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id = 'engineer-uploads' AND 
  get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "Clients can view files for their orders" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'engineer-uploads' AND 
  name ~ '^order-[0-9a-f-]+/'
);