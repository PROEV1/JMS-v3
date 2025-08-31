-- Create storage bucket for partner quotes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('partner-quotes', 'partner-quotes', false);

-- Create RLS policies for partner quotes bucket
CREATE POLICY "Authenticated users can view partner quote files"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-quotes' AND auth.role() = 'authenticated');

CREATE POLICY "Admins and partners can upload quote files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'partner-quotes' AND 
  auth.role() = 'authenticated' AND
  (
    -- Admin users can upload
    is_admin() OR
    -- Partner users can upload
    EXISTS (
      SELECT 1 FROM partner_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);

CREATE POLICY "Admins can manage all partner quote files"
ON storage.objects FOR ALL
USING (bucket_id = 'partner-quotes' AND is_admin());