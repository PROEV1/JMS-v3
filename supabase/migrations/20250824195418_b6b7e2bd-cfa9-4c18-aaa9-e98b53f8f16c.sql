-- Phase 1: Storage Security Foundation

-- Add storage RLS policies for granular access control
CREATE POLICY "Admin full access to all storage objects"
ON storage.objects
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'active'
  )
);

-- Client documents: clients can manage their own files
CREATE POLICY "Clients can manage their own documents"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'client-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT auth.uid()::text
    UNION
    SELECT c.user_id::text FROM public.clients c WHERE c.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'client-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT auth.uid()::text
    UNION 
    SELECT c.user_id::text FROM public.clients c WHERE c.user_id = auth.uid()
  )
);

-- Engineer uploads: engineers can manage their own uploads
CREATE POLICY "Engineers can manage their own uploads"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'engineer-uploads' AND
  (storage.foldername(name))[1] IN (
    SELECT e.user_id::text FROM public.engineers e WHERE e.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'engineer-uploads' AND
  (storage.foldername(name))[1] IN (
    SELECT e.user_id::text FROM public.engineers e WHERE e.user_id = auth.uid()
  )
);

-- Stock request attachments: engineers and admins can access
CREATE POLICY "Engineers and admins can manage stock request attachments"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'stock-request-attachments' AND
  (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND status = 'active') OR
    EXISTS (SELECT 1 FROM public.engineers WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'stock-request-attachments' AND
  (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND status = 'active') OR
    EXISTS (SELECT 1 FROM public.engineers WHERE user_id = auth.uid())
  )
);

-- Partner logos: admins and partner users can manage
CREATE POLICY "Admins and partner users can manage partner logos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'partner-logos' AND
  (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active') OR
    EXISTS (SELECT 1 FROM public.partner_users WHERE user_id = auth.uid() AND is_active = true)
  )
)
WITH CHECK (
  bucket_id = 'partner-logos' AND
  (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active') OR
    EXISTS (SELECT 1 FROM public.partner_users WHERE user_id = auth.uid() AND is_active = true)
  )
);

-- Add storage columns to relevant tables for dual-read capability

-- Add to files table
ALTER TABLE public.files 
ADD COLUMN storage_bucket text,
ADD COLUMN storage_path text;

-- Add to client_survey_media table  
ALTER TABLE public.client_survey_media
ADD COLUMN storage_bucket text,
ADD COLUMN storage_path text;

-- Add to engineer_uploads table
ALTER TABLE public.engineer_uploads
ADD COLUMN storage_bucket text, 
ADD COLUMN storage_path text;

-- Add to partners table
ALTER TABLE public.partners
ADD COLUMN logo_storage_bucket text,
ADD COLUMN logo_storage_path text;

-- Add indexes for performance
CREATE INDEX idx_files_storage_path ON public.files(storage_bucket, storage_path) WHERE storage_path IS NOT NULL;
CREATE INDEX idx_client_survey_media_storage_path ON public.client_survey_media(storage_bucket, storage_path) WHERE storage_path IS NOT NULL;
CREATE INDEX idx_engineer_uploads_storage_path ON public.engineer_uploads(storage_bucket, storage_path) WHERE storage_path IS NOT NULL;