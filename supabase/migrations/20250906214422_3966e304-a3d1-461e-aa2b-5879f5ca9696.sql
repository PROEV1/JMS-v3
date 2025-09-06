-- Create RPC function to mark client messages as read (admin only)
CREATE OR REPLACE FUNCTION mark_client_messages_read(p_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow admins to use this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Get the client's user_id first
  UPDATE messages 
  SET is_read = true 
  WHERE sender_id = (
    SELECT user_id 
    FROM clients 
    WHERE id = p_client_id
  ) 
  AND is_read = false;

  RETURN true;
END;
$$;