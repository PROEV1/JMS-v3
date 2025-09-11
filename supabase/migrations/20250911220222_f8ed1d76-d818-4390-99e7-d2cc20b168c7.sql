-- Create charger change log table
CREATE TABLE IF NOT EXISTS public.charger_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  original_charger_id UUID REFERENCES public.charger_inventory(id) ON DELETE SET NULL,
  new_charger_id UUID REFERENCES public.charger_inventory(id) ON DELETE SET NULL,
  original_serial_number TEXT,
  new_serial_number TEXT NOT NULL,
  reason_category TEXT NOT NULL,
  reason_description TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_charger_change_log_order_id ON public.charger_change_log(order_id);
CREATE INDEX idx_charger_change_log_engineer_id ON public.charger_change_log(engineer_id);
CREATE INDEX idx_charger_change_log_changed_at ON public.charger_change_log(changed_at);

-- Enable RLS
ALTER TABLE public.charger_change_log ENABLE ROW LEVEL SECURITY;

-- Create policies for charger change log
CREATE POLICY "Admins can manage all charger change logs"
ON public.charger_change_log
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Engineers can view their charger changes"
ON public.charger_change_log
FOR SELECT
TO authenticated
USING (
  engineer_id IN (
    SELECT id FROM public.engineers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Engineers can create charger change logs"
ON public.charger_change_log
FOR INSERT
TO authenticated
WITH CHECK (
  engineer_id IN (
    SELECT id FROM public.engineers WHERE user_id = auth.uid()
  ) AND created_by = auth.uid()
);

-- Update engineer_materials_used table to better support charger tracking
ALTER TABLE public.engineer_materials_used 
ADD COLUMN IF NOT EXISTS charger_inventory_id UUID REFERENCES public.charger_inventory(id) ON DELETE SET NULL;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_engineer_materials_used_charger_inventory_id 
ON public.engineer_materials_used(charger_inventory_id);