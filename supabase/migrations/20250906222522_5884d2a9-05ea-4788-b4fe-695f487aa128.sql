-- Fix column reference ambiguity in bulk upsert functions

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
    
    -- Try to find existing client by normalized email (fully qualify column)
    SELECT c.id INTO v_client_id
    FROM public.clients c
    WHERE LOWER(c.email) = v_email
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