-- Fix engineer access to their assigned orders and quotes
-- Update the security definer functions to include engineer access

CREATE OR REPLACE FUNCTION public.user_can_view_order(order_uuid uuid, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  -- Check if user is admin first
  IF public.is_admin(user_uuid) THEN
    RETURN true;
  END IF;
  
  -- Check if user owns the client for this order
  IF EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON o.client_id = c.id
    WHERE o.id = order_uuid 
    AND c.user_id = user_uuid
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is an engineer assigned to this order
  IF EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.engineers e ON o.engineer_id = e.id
    WHERE o.id = order_uuid 
    AND e.user_id = user_uuid
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_can_view_quote(quote_uuid uuid, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  -- Check if user is admin first
  IF public.is_admin(user_uuid) THEN
    RETURN true;
  END IF;
  
  -- Check if user owns the client for this quote
  IF EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.clients c ON q.client_id = c.id
    WHERE q.id = quote_uuid 
    AND c.user_id = user_uuid
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is an engineer assigned to orders for this quote
  IF EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.orders o ON o.quote_id = q.id
    JOIN public.engineers e ON o.engineer_id = e.id
    WHERE q.id = quote_uuid 
    AND e.user_id = user_uuid
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Also need to allow engineers to view clients for their assigned orders
CREATE OR REPLACE FUNCTION public.user_can_view_client(client_uuid uuid, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  -- Check if user is admin first
  IF public.is_admin(user_uuid) THEN
    RETURN true;
  END IF;
  
  -- Check if user owns this client
  IF EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_uuid 
    AND c.user_id = user_uuid
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is an engineer assigned to orders for this client
  IF EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.engineers e ON o.engineer_id = e.id
    WHERE o.client_id = client_uuid 
    AND e.user_id = user_uuid
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Add a policy for engineers to view clients they work with
DROP POLICY IF EXISTS "Engineers can view clients for assigned orders" ON public.clients;
CREATE POLICY "Engineers can view clients for assigned orders" 
ON public.clients FOR SELECT 
USING (public.user_can_view_client(id));