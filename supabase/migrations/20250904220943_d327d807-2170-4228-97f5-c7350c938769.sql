-- Allow engineers to manage purchase order lines for their assigned purchase orders
CREATE POLICY "Engineers can manage lines for their assigned POs" 
ON public.purchase_order_lines 
FOR ALL 
USING (
  purchase_order_id IN (
    SELECT po.id 
    FROM purchase_orders po
    JOIN engineers e ON po.engineer_id = e.id
    WHERE e.user_id = auth.uid()
  )
)
WITH CHECK (
  purchase_order_id IN (
    SELECT po.id 
    FROM purchase_orders po
    JOIN engineers e ON po.engineer_id = e.id
    WHERE e.user_id = auth.uid()
  )
);