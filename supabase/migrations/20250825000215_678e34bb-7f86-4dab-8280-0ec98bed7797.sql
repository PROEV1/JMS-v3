-- Fix storage bucket configuration for client-documents to allow image uploads
UPDATE storage.buckets 
SET allowed_mime_types = NULL 
WHERE id = 'client-documents';

-- Ensure the bucket allows file uploads
UPDATE storage.buckets 
SET file_size_limit = 52428800  -- 50MB limit
WHERE id = 'client-documents';