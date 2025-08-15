-- Create the client-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-documents', 'client-documents', true, 52428800, ARRAY['text/html', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the client-documents bucket
CREATE POLICY "Allow public access to client documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'client-documents');

CREATE POLICY "Allow service role to upload client documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'client-documents' AND auth.role() = 'service_role');

CREATE POLICY "Allow service role to update client documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'client-documents' AND auth.role() = 'service_role');

CREATE POLICY "Allow service role to delete client documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'client-documents' AND auth.role() = 'service_role');