-- Update quotes table to match requirements
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS range TEXT,
ADD COLUMN IF NOT EXISTS finish TEXT,
ADD COLUMN IF NOT EXISTS deposit_required NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_reference TEXT,
ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS designer_name TEXT,
ADD COLUMN IF NOT EXISTS room_info TEXT;

-- Update projects table to match orders requirements  
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS installer_name TEXT;

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash', 'finance')),
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  paid_on TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies for payments
CREATE POLICY "Clients can view their own payments" 
ON public.payments 
FOR SELECT 
USING (quote_id IN (
  SELECT q.id FROM public.quotes q 
  JOIN public.clients c ON q.client_id = c.id 
  WHERE c.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all payments" 
ON public.payments 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- Update files table to include document types
ALTER TABLE public.files
ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('quote', 'terms', 'funding', 'room_pack', 'other'));