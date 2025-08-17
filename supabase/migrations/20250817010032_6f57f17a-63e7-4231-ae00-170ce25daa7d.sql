-- Drop ALL existing policies that might cause recursion and start fresh
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

-- Create simple, direct security definer functions
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid 
    AND role = 'admin' 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_manager(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid 
    AND role = 'manager' 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate policies with simple logic - CLIENTS table
CREATE POLICY "Admins can manage all clients" 
ON public.clients FOR ALL 
USING (public.is_admin());

CREATE POLICY "Clients can view their own data" 
ON public.clients FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Clients can update their own data" 
ON public.clients FOR UPDATE 
USING (auth.uid() = user_id);

-- Recreate policies - ORDERS table  
CREATE POLICY "Admins can manage all orders" 
ON public.orders FOR ALL 
USING (public.is_admin());

CREATE POLICY "Clients can view their own orders" 
ON public.orders FOR SELECT 
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Clients can update their own orders" 
ON public.orders FOR UPDATE 
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Clients can create their own orders" 
ON public.orders FOR INSERT 
WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Recreate policies - QUOTES table
CREATE POLICY "Admins can manage all quotes" 
ON public.quotes FOR ALL 
USING (public.is_admin());

CREATE POLICY "Clients can view their own quotes" 
ON public.quotes FOR SELECT 
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Clients can update their own quotes" 
ON public.quotes FOR UPDATE 
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Recreate policies - LEADS table
CREATE POLICY "Admins and managers can manage leads" 
ON public.leads FOR ALL 
USING (public.is_admin() OR public.is_manager());

CREATE POLICY "Clients can view their own leads" 
ON public.leads FOR SELECT 
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));