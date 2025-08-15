-- Add RLS policies for engineers to view clients and quotes for their assigned orders

-- Allow engineers to view client data for orders they are assigned to
CREATE POLICY "Engineers can view clients for their assigned orders" 
ON public.clients 
FOR SELECT 
USING (id IN (
  SELECT client_id FROM orders o 
  JOIN engineers e ON o.engineer_id = e.id 
  WHERE e.user_id = auth.uid()
));

-- Allow engineers to view quote data for orders they are assigned to  
CREATE POLICY "Engineers can view quotes for their assigned orders"
ON public.quotes
FOR SELECT
USING (id IN (
  SELECT quote_id FROM orders o
  JOIN engineers e ON o.engineer_id = e.id
  WHERE e.user_id = auth.uid()
));