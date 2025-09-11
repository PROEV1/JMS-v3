-- Add assigned_order_id column to charger_inventory table to link chargers to specific jobs
ALTER TABLE public.charger_inventory 
ADD COLUMN assigned_order_id uuid REFERENCES public.orders(id);

-- Create index for better performance when querying chargers by order
CREATE INDEX idx_charger_inventory_assigned_order_id ON public.charger_inventory(assigned_order_id);

-- Add index for better performance when querying chargers by engineer and order
CREATE INDEX idx_charger_inventory_engineer_order ON public.charger_inventory(engineer_id, assigned_order_id);

-- Update RLS policies to allow engineers to view chargers assigned to their orders
CREATE POLICY "Engineers can view chargers assigned to their orders" 
ON public.charger_inventory 
FOR SELECT 
USING (
  is_admin() OR 
  (engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid())) OR
  (assigned_order_id IN (SELECT id FROM orders WHERE engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid())))
);