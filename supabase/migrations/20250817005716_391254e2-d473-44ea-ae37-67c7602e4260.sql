-- Fix infinite recursion in RLS policies by using security definer functions

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Engineers can view clients for assigned orders" ON public.clients;
DROP POLICY IF EXISTS "Engineers can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Engineers can update assigned orders" ON public.orders;

-- Create security definer functions to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_engineer_id_for_user(user_uuid uuid)
RETURNS uuid AS $$
  SELECT id FROM public.engineers WHERE user_id = user_uuid LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_is_engineer_for_order(order_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.engineers e ON e.id = o.engineer_id
    WHERE o.id = order_uuid AND e.user_id = user_uuid
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Recreate the policies with security definer functions
CREATE POLICY "Engineers can view clients for assigned orders" 
ON public.clients 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.client_id = clients.id 
    AND o.engineer_id = public.get_engineer_id_for_user(auth.uid())
  )
);

CREATE POLICY "Engineers can view assigned orders" 
ON public.orders 
FOR SELECT 
USING (engineer_id = public.get_engineer_id_for_user(auth.uid()));

CREATE POLICY "Engineers can update assigned orders" 
ON public.orders 
FOR UPDATE 
USING (engineer_id = public.get_engineer_id_for_user(auth.uid()))
WITH CHECK (engineer_id = public.get_engineer_id_for_user(auth.uid()));