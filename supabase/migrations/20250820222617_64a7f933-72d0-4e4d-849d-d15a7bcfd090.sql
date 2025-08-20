-- Create storage bucket for stock request attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('stock-request-attachments', 'stock-request-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for stock request attachments
CREATE POLICY "Stock request attachments are viewable by admins and engineers" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'stock-request-attachments' AND (
  is_admin() OR 
  auth.role() = 'authenticated'
));

CREATE POLICY "Engineers can upload stock request attachments" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'stock-request-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Engineers can update their own stock request attachments" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'stock-request-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete stock request attachments" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'stock-request-attachments' AND is_admin());