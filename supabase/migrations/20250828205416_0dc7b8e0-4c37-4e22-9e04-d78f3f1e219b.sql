-- Create a new table specifically for charger inventory tracking
-- This will be separate from charger_dispatches which is for order-specific chargers
CREATE TABLE IF NOT EXISTS public.charger_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  charger_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  engineer_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(serial_number)
);

-- Enable RLS
ALTER TABLE public.charger_inventory ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all charger inventory" 
ON public.charger_inventory 
FOR ALL 
USING (is_admin());

CREATE POLICY "Engineers can view charger inventory" 
ON public.charger_inventory 
FOR SELECT 
USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM engineers 
    WHERE user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_charger_inventory_updated_at
BEFORE UPDATE ON public.charger_inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();