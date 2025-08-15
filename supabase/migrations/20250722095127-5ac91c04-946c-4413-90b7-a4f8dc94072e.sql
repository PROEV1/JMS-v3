-- Create storage bucket for client documents
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', false);

-- Create storage policies for admin access to documents
CREATE POLICY "Admins can view all documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'client-documents' AND get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'client-documents' AND get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'client-documents' AND get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'client-documents' AND get_user_role(auth.uid()) = 'admin');

-- Clients can view their own documents
CREATE POLICY "Clients can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = auth.uid()::text);