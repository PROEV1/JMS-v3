-- Create engineer_materials_used table
CREATE TABLE public.engineer_materials_used (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  serial_number TEXT,
  location_id UUID REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  notes TEXT,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.engineer_materials_used ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all materials used" 
ON public.engineer_materials_used 
FOR ALL 
USING (is_admin());

CREATE POLICY "Engineers can manage materials for their orders" 
ON public.engineer_materials_used 
FOR ALL 
USING (
  engineer_id IN (
    SELECT id FROM public.engineers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view materials used on their orders" 
ON public.engineer_materials_used 
FOR SELECT 
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  )
);

-- Create function to record material usage with optional stock deduction
CREATE OR REPLACE FUNCTION public.record_material_usage(
  p_order_id UUID,
  p_engineer_id UUID,
  p_item_id UUID,
  p_item_name TEXT,
  p_quantity INTEGER,
  p_serial_number TEXT DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_deduct_stock BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage_id UUID;
BEGIN
  -- Insert material usage record
  INSERT INTO public.engineer_materials_used (
    order_id, engineer_id, item_id, item_name, quantity, 
    serial_number, location_id, notes
  ) VALUES (
    p_order_id, p_engineer_id, p_item_id, p_item_name, p_quantity,
    p_serial_number, p_location_id, p_notes
  ) RETURNING id INTO v_usage_id;

  -- Optionally deduct from inventory if location is specified
  IF p_deduct_stock AND p_item_id IS NOT NULL AND p_location_id IS NOT NULL THEN
    INSERT INTO public.inventory_txns (
      item_id, location_id, direction, qty, reference, notes, created_by
    ) VALUES (
      p_item_id, p_location_id, 'out', p_quantity,
      'Material used on order: ' || p_order_id::text,
      'Used by engineer on job. Usage ID: ' || v_usage_id::text,
      auth.uid()
    );
  END IF;

  RETURN v_usage_id;
END;
$$;

-- Create function to revoke material usage (optional - for corrections)
CREATE OR REPLACE FUNCTION public.revoke_material_usage(
  p_usage_id UUID,
  p_restore_stock BOOLEAN DEFAULT false
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage_record RECORD;
BEGIN
  -- Get the usage record
  SELECT * INTO v_usage_record 
  FROM public.engineer_materials_used 
  WHERE id = p_usage_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material usage record not found';
  END IF;

  -- Check permission
  IF NOT (
    is_admin() OR 
    v_usage_record.engineer_id IN (
      SELECT id FROM public.engineers WHERE user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to revoke material usage';
  END IF;

  -- Optionally restore stock
  IF p_restore_stock AND v_usage_record.item_id IS NOT NULL AND v_usage_record.location_id IS NOT NULL THEN
    INSERT INTO public.inventory_txns (
      item_id, location_id, direction, qty, reference, notes, created_by
    ) VALUES (
      v_usage_record.item_id, v_usage_record.location_id, 'in', v_usage_record.quantity,
      'Material usage revoked for order: ' || v_usage_record.order_id::text,
      'Stock restored. Original usage ID: ' || p_usage_id::text,
      auth.uid()
    );
  END IF;

  -- Delete the usage record
  DELETE FROM public.engineer_materials_used WHERE id = p_usage_id;

  RETURN true;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_engineer_materials_used_updated_at
  BEFORE UPDATE ON public.engineer_materials_used
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();