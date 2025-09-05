-- Update revoke_material_usage function to handle chargers
CREATE OR REPLACE FUNCTION public.revoke_material_usage(
  p_usage_id uuid, 
  p_restore_stock boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_usage_record RECORD;
  v_charger_id UUID;
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

  -- Handle charger restoration by serial number
  IF v_usage_record.serial_number IS NOT NULL THEN
    SELECT id INTO v_charger_id 
    FROM public.charger_inventory 
    WHERE serial_number = v_usage_record.serial_number 
      AND engineer_id = v_usage_record.engineer_id 
      AND status = 'deployed'
    LIMIT 1;
    
    IF v_charger_id IS NOT NULL THEN
      -- Restore charger status to 'assigned'
      UPDATE public.charger_inventory 
      SET status = 'assigned',
          notes = REPLACE(COALESCE(notes, ''), ' Used on order: ' || v_usage_record.order_id::text, ''),
          updated_at = now()
      WHERE id = v_charger_id;
    END IF;
  END IF;

  -- Handle regular inventory restoration
  IF p_restore_stock AND v_usage_record.item_id IS NOT NULL AND v_usage_record.location_id IS NOT NULL THEN
    INSERT INTO public.inventory_txns (
      item_id, location_id, direction, qty, reference, notes, created_by, status, approved_by, approved_at
    ) VALUES (
      v_usage_record.item_id, v_usage_record.location_id, 'in', v_usage_record.quantity,
      'Material usage revoked for order: ' || v_usage_record.order_id::text,
      'Stock restored. Original usage ID: ' || p_usage_id::text,
      auth.uid(), 'approved', auth.uid(), now()
    );
  END IF;

  -- Delete the usage record
  DELETE FROM public.engineer_materials_used WHERE id = p_usage_id;

  RETURN true;
END;
$function$