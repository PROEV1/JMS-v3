-- Fix type casting issues in bulk order upsert function

CREATE OR REPLACE FUNCTION upsert_orders_for_partner_bulk(
  p_orders JSONB,
  p_partner_id UUID
) RETURNS TABLE(partner_external_id TEXT, order_id UUID, was_insert BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_record JSONB;
  v_order_id UUID;
  v_partner_external_id TEXT;
  v_was_insert BOOLEAN;
BEGIN
  -- Process each order in the batch
  FOR order_record IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    v_partner_external_id := order_record->>'partner_external_id';
    
    -- Try to find existing order (fully qualify table reference)
    SELECT o.id INTO v_order_id
    FROM public.orders o
    WHERE o.partner_id = p_partner_id 
      AND o.partner_external_id = v_partner_external_id
    LIMIT 1;
    
    IF v_order_id IS NOT NULL THEN
      -- Update existing order with proper type casting
      UPDATE public.orders
      SET 
        client_id = (order_record->>'client_id')::UUID,
        partner_status = order_record->>'partner_status',
        scheduled_install_date = CASE 
          WHEN order_record->>'scheduled_install_date' IS NOT NULL 
          THEN (order_record->>'scheduled_install_date')::TIMESTAMP WITH TIME ZONE
          ELSE NULL
        END,
        engineer_id = CASE 
          WHEN order_record->>'engineer_id' IS NOT NULL 
          THEN (order_record->>'engineer_id')::UUID
          ELSE NULL
        END,
        total_amount = CASE 
          WHEN order_record->>'total_amount' IS NOT NULL 
          THEN (order_record->>'total_amount')::NUMERIC
          ELSE NULL
        END,
        estimated_duration_hours = CASE 
          WHEN order_record->>'estimated_duration_hours' IS NOT NULL 
          THEN (order_record->>'estimated_duration_hours')::NUMERIC
          ELSE NULL
        END,
        job_type = CASE 
          WHEN order_record->>'job_type' IS NOT NULL 
          THEN (order_record->>'job_type')::order_job_type
          ELSE NULL
        END,
        job_address = order_record->>'job_address',
        postcode = order_record->>'postcode',
        amount_paid = COALESCE((order_record->>'amount_paid')::NUMERIC, 0),
        deposit_amount = COALESCE((order_record->>'deposit_amount')::NUMERIC, 0),
        status = CASE 
          WHEN order_record->>'status' IS NOT NULL 
          THEN (order_record->>'status')::order_status
          ELSE 'active'::order_status
        END,
        survey_required = COALESCE((order_record->>'survey_required')::BOOLEAN, true),
        scheduling_suppressed = COALESCE((order_record->>'scheduling_suppressed')::BOOLEAN, false),
        scheduling_suppressed_reason = order_record->>'scheduling_suppressed_reason',
        updated_at = now()
      WHERE id = v_order_id;
      
      v_was_insert := FALSE;
    ELSE
      -- Insert new order with proper type casting
      INSERT INTO public.orders (
        client_id,
        partner_id,
        partner_external_id,
        partner_status,
        scheduled_install_date,
        engineer_id,
        total_amount,
        estimated_duration_hours,
        job_type,
        job_address,
        postcode,
        amount_paid,
        deposit_amount,
        status,
        survey_required,
        scheduling_suppressed,
        scheduling_suppressed_reason,
        is_partner_job,
        quote_id
      ) VALUES (
        (order_record->>'client_id')::UUID,
        p_partner_id,
        v_partner_external_id,
        order_record->>'partner_status',
        CASE 
          WHEN order_record->>'scheduled_install_date' IS NOT NULL 
          THEN (order_record->>'scheduled_install_date')::TIMESTAMP WITH TIME ZONE
          ELSE NULL
        END,
        CASE 
          WHEN order_record->>'engineer_id' IS NOT NULL 
          THEN (order_record->>'engineer_id')::UUID
          ELSE NULL
        END,
        CASE 
          WHEN order_record->>'total_amount' IS NOT NULL 
          THEN (order_record->>'total_amount')::NUMERIC
          ELSE NULL
        END,
        CASE 
          WHEN order_record->>'estimated_duration_hours' IS NOT NULL 
          THEN (order_record->>'estimated_duration_hours')::NUMERIC
          ELSE NULL
        END,
        CASE 
          WHEN order_record->>'job_type' IS NOT NULL 
          THEN (order_record->>'job_type')::order_job_type
          ELSE 'installation'::order_job_type
        END,
        order_record->>'job_address',
        order_record->>'postcode',
        COALESCE((order_record->>'amount_paid')::NUMERIC, 0),
        COALESCE((order_record->>'deposit_amount')::NUMERIC, 0),
        CASE 
          WHEN order_record->>'status' IS NOT NULL 
          THEN (order_record->>'status')::order_status
          ELSE 'active'::order_status
        END,
        COALESCE((order_record->>'survey_required')::BOOLEAN, true),
        COALESCE((order_record->>'scheduling_suppressed')::BOOLEAN, false),
        order_record->>'scheduling_suppressed_reason',
        true,
        NULL -- quote_id
      ) RETURNING id INTO v_order_id;
      
      v_was_insert := TRUE;
    END IF;
    
    -- Return mapping
    RETURN QUERY SELECT v_partner_external_id, v_order_id, v_was_insert;
  END LOOP;
END;
$$;