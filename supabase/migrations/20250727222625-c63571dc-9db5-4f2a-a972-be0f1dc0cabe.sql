-- Create table to store completion checklist items per order
CREATE TABLE public.order_completion_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  item_label TEXT NOT NULL,
  item_description TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  engineer_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_completion_checklist ENABLE ROW LEVEL SECURITY;

-- Create policies for checklist access
CREATE POLICY "Admins can manage all checklist items" 
ON public.order_completion_checklist 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Engineers can manage checklist for their orders"
ON public.order_completion_checklist
FOR ALL
USING (
  order_id IN (
    SELECT id FROM orders WHERE engineer_id IN (
      SELECT id FROM engineers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Clients can view checklist for their orders"
ON public.order_completion_checklist
FOR SELECT
USING (
  order_id IN (
    SELECT id FROM orders WHERE client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_order_completion_checklist_updated_at
  BEFORE UPDATE ON public.order_completion_checklist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();