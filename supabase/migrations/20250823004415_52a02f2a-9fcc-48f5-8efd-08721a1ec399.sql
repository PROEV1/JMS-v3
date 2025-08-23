-- Create storage bucket for partner logos
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-logos', 'partner-logos', true);

-- Create policies for partner logos bucket
CREATE POLICY "Partner logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'partner-logos');

CREATE POLICY "Admins can upload partner logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'partner-logos' AND is_admin());

CREATE POLICY "Admins can update partner logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'partner-logos' AND is_admin());