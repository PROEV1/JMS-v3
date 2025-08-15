-- Update the client-documents bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'client-documents';