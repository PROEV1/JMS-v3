-- Fix bulk upsert functions to handle JSONB arrays properly

CREATE OR REPLACE FUNCTION upsert_clients_for_partner_bulk(
  p_clients JSONB,
  p_partner_id UUID
) RETURNS TABLE(email TEXT, client_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_record JSONB;
  v_client_id UUID;
  v_email TEXT;
BEGIN
  -- Process each client in the batch
  FOR client_record IN SELECT * FROM jsonb_array_elements(p_clients)
  LOOP
    -- Extract normalized email
    v_email := LOWER(TRIM(client_record->>'email'));
    
    -- Try to find existing client by normalized email
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE LOWER(email) = v_email
    LIMIT 1;
    
    IF v_client_id IS NOT NULL THEN
      -- Update existing client
      UPDATE public.clients
      SET 
        full_name = client_record->>'full_name',
        phone = client_record->>'phone',
        address = client_record->>'address',
        postcode = client_record->>'postcode',
        is_partner_client = true,
        partner_id = p_partner_id,
        updated_at = now()
      WHERE id = v_client_id;
    ELSE
      -- Insert new client
      INSERT INTO public.clients (
        full_name, email, phone, address, postcode, 
        is_partner_client, partner_id
      ) VALUES (
        client_record->>'full_name', 
        v_email, 
        client_record->>'phone', 
        client_record->>'address', 
        client_record->>'postcode',
        true, 
        p_partner_id
      ) RETURNING id INTO v_client_id;
    END IF;
    
    -- Return email -> client_id mapping
    RETURN QUERY SELECT v_email, v_client_id;
  END LOOP;
END;
$$;

-- Fix bulk order upsert function
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
    
    -- Try to find existing order
    SELECT id INTO v_order_id
    FROM public.orders
    WHERE partner_id = p_partner_id 
      AND partner_external_id = v_partner_external_id
    LIMIT 1;
    
    IF v_order_id IS NOT NULL THEN
      -- Update existing order
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
        job_type = order_record->>'job_type',
        job_address = order_record->>'job_address',
        postcode = order_record->>'postcode',
        amount_paid = COALESCE((order_record->>'amount_paid')::NUMERIC, 0),
        deposit_amount = COALESCE((order_record->>'deposit_amount')::NUMERIC, 0),
        status = COALESCE(order_record->>'status', 'active'),
        survey_required = COALESCE((order_record->>'survey_required')::BOOLEAN, true),
        scheduling_suppressed = COALESCE((order_record->>'scheduling_suppressed')::BOOLEAN, false),
        scheduling_suppressed_reason = order_record->>'scheduling_suppressed_reason',
        updated_at = now()
      WHERE id = v_order_id;
      
      v_was_insert := FALSE;
    ELSE
      -- Insert new order
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
        order_record->>'job_type',
        order_record->>'job_address',
        order_record->>'postcode',
        COALESCE((order_record->>'amount_paid')::NUMERIC, 0),
        COALESCE((order_record->>'deposit_amount')::NUMERIC, 0),
        COALESCE(order_record->>'status', 'active'),
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