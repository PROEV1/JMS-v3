-- Create order_notes table for tracking notes on orders
CREATE TABLE public.order_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  note_content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on the table
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage all order notes" 
ON public.order_notes 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Engineers can view notes for their assigned orders" 
ON public.order_notes 
FOR SELECT 
USING (
  order_id IN (
    SELECT o.id 
    FROM orders o 
    JOIN engineers e ON o.engineer_id = e.id 
    WHERE e.user_id = auth.uid()
  )
);

CREATE POLICY "Engineers can add notes to their assigned orders" 
ON public.order_notes 
FOR INSERT 
WITH CHECK (
  created_by = auth.uid() AND
  order_id IN (
    SELECT o.id 
    FROM orders o 
    JOIN engineers e ON o.engineer_id = e.id 
    WHERE e.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view notes for their orders" 
ON public.order_notes 
FOR SELECT 
USING (
  order_id IN (
    SELECT o.id 
    FROM orders o 
    JOIN clients c ON o.client_id = c.id 
    WHERE c.user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_order_notes_order_id ON public.order_notes(order_id);
CREATE INDEX idx_order_notes_created_at ON public.order_notes(created_at DESC);