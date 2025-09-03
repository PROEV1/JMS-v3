-- Fix client upserts by implementing proper logic without ON CONFLICT
-- Create function to handle client upserts safely

CREATE OR REPLACE FUNCTION upsert_client_for_partner(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_postcode TEXT,
  p_partner_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Try to find existing client by email (case-insensitive)
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE LOWER(email) = p_email
  LIMIT 1;
  
  IF v_client_id IS NOT NULL THEN
    -- Update existing client
    UPDATE public.clients
    SET 
      full_name = p_full_name,
      phone = p_phone,
      address = p_address,
      postcode = p_postcode,
      is_partner_client = true,
      partner_id = p_partner_id,
      updated_at = now()
    WHERE id = v_client_id;
    
    RETURN v_client_id;
  ELSE
    -- Insert new client
    INSERT INTO public.clients (
      full_name, email, phone, address, postcode, 
      is_partner_client, partner_id
    ) VALUES (
      p_full_name, p_email, p_phone, p_address, p_postcode,
      true, p_partner_id
    ) RETURNING id INTO v_client_id;
    
    RETURN v_client_id;
  END IF;
END;
$$;