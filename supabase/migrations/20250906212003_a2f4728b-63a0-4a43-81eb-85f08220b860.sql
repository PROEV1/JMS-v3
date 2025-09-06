-- Create function to get clients with their last message and unread count
CREATE OR REPLACE FUNCTION get_clients_with_last_message()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  user_id UUID,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH client_messages AS (
    SELECT 
      c.id,
      c.full_name,
      c.email,
      c.user_id,
      m.content as last_message,
      m.created_at as last_message_at,
      ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY m.created_at DESC) as rn
    FROM clients c
    INNER JOIN messages m ON (m.client_id = c.id OR m.sender_id = c.user_id)
  ),
  unread_counts AS (
    SELECT 
      c.id as client_id,
      COUNT(m.id) as unread_count
    FROM clients c
    LEFT JOIN messages m ON (m.client_id = c.id OR m.sender_id = c.user_id)
    WHERE m.is_read = false 
      AND m.sender_id = c.user_id -- Only count messages FROM the client as unread
    GROUP BY c.id
  )
  SELECT 
    cm.id,
    cm.full_name,
    cm.email,
    cm.user_id,
    cm.last_message,
    cm.last_message_at,
    COALESCE(uc.unread_count, 0) as unread_count
  FROM client_messages cm
  LEFT JOIN unread_counts uc ON uc.client_id = cm.id
  WHERE cm.rn = 1
  ORDER BY cm.last_message_at DESC NULLS LAST, cm.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;