-- Fix engineer user permissions by ensuring engineer records have is_active column
-- First check if is_active column exists on engineers table, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'engineers' AND column_name = 'is_active') THEN
        ALTER TABLE public.engineers ADD COLUMN is_active boolean DEFAULT true;
    END IF;
END $$;

-- Update the inventory items policy to be more robust
DROP POLICY IF EXISTS "Engineers can view inventory items for stock requests" ON public.inventory_items;

CREATE POLICY "Engineers can view inventory items for stock requests"
ON public.inventory_items
FOR SELECT 
TO authenticated
USING (
  -- Allow if user is an engineer (using the engineers table)
  EXISTS (
    SELECT 1 FROM public.engineers 
    WHERE user_id = auth.uid()
  )
  OR is_admin() 
  OR is_manager()
);