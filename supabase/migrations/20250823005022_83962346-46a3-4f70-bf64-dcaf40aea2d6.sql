-- Update the can_access_partner_data function to handle charger_manufacturer role
CREATE OR REPLACE FUNCTION public.can_access_partner_data(user_uuid uuid, target_partner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  user_partner_id UUID;
  user_role TEXT;
BEGIN
  -- Get user's partner info
  SELECT partner_id, role INTO user_partner_id, user_role
  FROM partner_users 
  WHERE user_id = user_uuid AND is_active = true;
  
  IF user_partner_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Manufacturer or Charger Manufacturer can see their own data and all dealer data under them
  IF user_role IN ('partner_manufacturer', 'partner_charger_manufacturer') THEN
    RETURN target_partner_id = user_partner_id OR 
           EXISTS (SELECT 1 FROM partners WHERE id = target_partner_id AND parent_partner_id = user_partner_id);
  END IF;
  
  -- Dealer can only see their own data
  IF user_role = 'partner_dealer' THEN
    RETURN target_partner_id = user_partner_id;
  END IF;
  
  RETURN false;
END;
$function$;