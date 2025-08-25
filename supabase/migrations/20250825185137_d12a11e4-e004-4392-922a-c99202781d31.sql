-- Add DELETE policy for quotes table to allow admins to delete quotes
CREATE POLICY "Admins can delete quotes" ON public.quotes
  FOR DELETE
  USING (is_admin());