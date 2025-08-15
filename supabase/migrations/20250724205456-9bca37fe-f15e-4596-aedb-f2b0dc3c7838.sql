-- Drop the existing service role policy and create a new one that properly allows service role access
DROP POLICY IF EXISTS "Service role can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update documents" ON storage.objects;

-- Create a comprehensive policy for service role (edge functions) to manage documents
CREATE POLICY "Allow service role full access to client documents" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'client-documents' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'client-documents' AND auth.role() = 'service_role');