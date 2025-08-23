-- Add engineer_id column to inventory_locations table to support van assignments
ALTER TABLE public.inventory_locations 
ADD COLUMN engineer_id uuid REFERENCES public.engineers(id);

-- Add index for better performance
CREATE INDEX idx_inventory_locations_engineer_id ON public.inventory_locations(engineer_id);

-- Update RLS policies to allow engineers to see their van locations
CREATE POLICY "Engineers can view their van locations" ON public.inventory_locations
FOR SELECT 
USING (
  engineer_id IN (
    SELECT id FROM public.engineers WHERE user_id = auth.uid()
  )
);