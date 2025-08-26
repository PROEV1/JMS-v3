-- Allow engineers to view inventory items for stock requests
CREATE POLICY "Engineers can view inventory items for stock requests"
ON public.inventory_items
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.engineers 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
  OR is_admin() 
  OR is_manager()
);