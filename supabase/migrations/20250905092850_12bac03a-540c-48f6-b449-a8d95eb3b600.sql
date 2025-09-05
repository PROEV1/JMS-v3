-- Update record_material_usage function to handle charger usage
CREATE OR REPLACE FUNCTION public.record_material_usage(
  p_order_id uuid, 
  p_engineer_id uuid, 
  p_item_id uuid, 
  p_item_name text, 
  p_quantity integer, 
  p_serial_number text DEFAULT NULL::text, 
  p_location_id uuid DEFAULT NULL::uuid, 
  p_notes text DEFAULT NULL::text, 
  p_deduct_stock boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_usage_id UUID;
  v_txn_id UUID;
  v_charger_id UUID;
BEGIN
  -- Insert material usage record
  INSERT INTO public.engineer_materials_used (
    order_id, engineer_id, item_id, item_name, quantity, 
    serial_number, location_id, notes
  ) VALUES (
    p_order_id, p_engineer_id, p_item_id, p_item_name, p_quantity,
    p_serial_number, p_location_id, p_notes
  ) RETURNING id INTO v_usage_id;

  -- Handle charger usage by serial number
  IF p_serial_number IS NOT NULL THEN
    SELECT id INTO v_charger_id 
    FROM public.charger_inventory 
    WHERE serial_number = p_serial_number 
      AND engineer_id = p_engineer_id 
      AND status = 'assigned'
    LIMIT 1;
    
    IF v_charger_id IS NOT NULL THEN
      -- Update charger status to 'deployed' and link to order
      UPDATE public.charger_inventory 
      SET status = 'deployed',
          notes = COALESCE(notes, '') || ' Used on order: ' || p_order_id::text,
          updated_at = now()
      WHERE id = v_charger_id;
    END IF;
  END IF;

  -- Handle regular inventory items
  IF p_deduct_stock AND p_item_id IS NOT NULL AND p_location_id IS NOT NULL THEN
    INSERT INTO public.inventory_txns (
      item_id, location_id, direction, qty, reference, notes, created_by, status, approved_by, approved_at
    ) VALUES (
      p_item_id, p_location_id, 'out', p_quantity,
      'Material used on order: ' || p_order_id::text,
      'Used by engineer on job. Usage ID: ' || v_usage_id::text,
      auth.uid(), 'approved', auth.uid(), now()
    ) RETURNING id INTO v_txn_id;
  END IF;

  RETURN v_usage_id;
END;
$function$