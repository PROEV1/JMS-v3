-- Check existing storage policies for client-documents bucket
SELECT * FROM storage.objects WHERE bucket_id = 'client-documents' LIMIT 5;

-- Create storage policies for the client-documents bucket to allow edge functions to upload
-- First, ensure the bucket policies allow authenticated users and service role to manage files

-- Allow authenticated users to read their own documents
CREATE POLICY "Users can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'client-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow service role (edge functions) to upload documents  
CREATE POLICY "Service role can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'client-documents');

-- Allow service role to update documents
CREATE POLICY "Service role can update documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'client-documents');

-- Allow users to access documents in quotes folder (for generated PDFs)
CREATE POLICY "Users can view quote documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = 'quotes');