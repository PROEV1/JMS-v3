-- Fix infinite recursion by creating proper security definer functions
-- These functions run with elevated privileges and don't trigger RLS policies

-- First, drop ALL existing problematic policies
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can update their own data" ON public.clients;
DROP POLICY IF EXISTS "Clients can view their own data" ON public.clients;
DROP POLICY IF EXISTS "Engineers can view clients for assigned orders" ON public.clients;

DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Engineers can update assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Engineers can view assigned orders" ON public.orders;

DROP POLICY IF EXISTS "Admins can manage all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Clients can update their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Clients can view their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Engineers can view quotes for assigned orders" ON public.quotes;

DROP POLICY IF EXISTS "Admins and managers can manage leads" ON public.leads;
DROP POLICY IF EXISTS "Clients can view their own leads" ON public.leads;

-- Create security definer functions that bypass RLS to prevent recursion
CREATE OR REPLACE FUNCTION public.user_owns_client(client_uuid uuid, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  -- This function runs with SECURITY DEFINER privileges, bypassing RLS
  RETURN EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id = client_uuid 
    AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_can_view_order(order_uuid uuid, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  -- Check if user is admin first
  IF public.is_admin(user_uuid) THEN
    RETURN true;
  END IF;
  
  -- Check if user owns the client for this order
  RETURN EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.clients c ON o.client_id = c.id
    WHERE o.id = order_uuid 
    AND c.user_id = user_uuid
  );
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
  RETURN EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.clients c ON q.client_id = c.id
    WHERE q.id = quote_uuid 
    AND c.user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Now create simple policies that only call security definer functions
-- CLIENTS table policies
CREATE POLICY "Admins can manage all clients" 
ON public.clients FOR ALL 
USING (public.is_admin());

CREATE POLICY "Users can view their own client data" 
ON public.clients FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own client data" 
ON public.clients FOR UPDATE 
USING (auth.uid() = user_id);

-- ORDERS table policies
CREATE POLICY "Users can view orders they can access" 
ON public.orders FOR SELECT 
USING (public.user_can_view_order(id));

CREATE POLICY "Users can update orders they can access" 
ON public.orders FOR UPDATE 
USING (public.user_can_view_order(id));

CREATE POLICY "Users can create orders for their clients" 
ON public.orders FOR INSERT 
WITH CHECK (public.user_owns_client(client_id, auth.uid()) OR public.is_admin());

-- QUOTES table policies
CREATE POLICY "Users can view quotes they can access" 
ON public.quotes FOR SELECT 
USING (public.user_can_view_quote(id));

CREATE POLICY "Users can update quotes they can access" 
ON public.quotes FOR UPDATE 
USING (public.user_can_view_quote(id));

-- LEADS table policies
CREATE POLICY "Admins and managers can manage leads" 
ON public.leads FOR ALL 
USING (public.is_admin() OR public.is_manager());

CREATE POLICY "Users can view leads for their clients" 
ON public.leads FOR SELECT 
USING (public.user_owns_client(client_id, auth.uid()) OR public.is_admin() OR public.is_manager());