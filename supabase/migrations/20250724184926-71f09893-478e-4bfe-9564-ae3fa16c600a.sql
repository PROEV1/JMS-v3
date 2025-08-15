-- Create orders table to store accepted quotes as orders
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  job_address TEXT,
  installation_date TIMESTAMP WITH TIME ZONE,
  installation_notes TEXT,
  agreement_signed_at TIMESTAMP WITH TIME ZONE,
  agreement_document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin_settings table for payment configuration
CREATE TABLE public.admin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_payments table to track payments
CREATE TABLE public.order_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_type TEXT NOT NULL, -- 'deposit', 'balance', 'full'
  payment_method TEXT, -- 'stripe', 'manual', etc.
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for orders
CREATE POLICY "Clients can view their own orders" 
ON public.orders 
FOR SELECT 
USING (client_id IN ( SELECT clients.id FROM clients WHERE clients.user_id = auth.uid()));

CREATE POLICY "Admins can manage all orders" 
ON public.orders 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Clients can update their own orders" 
ON public.orders 
FOR UPDATE 
USING (client_id IN ( SELECT clients.id FROM clients WHERE clients.user_id = auth.uid()));

-- Create RLS policies for admin_settings
CREATE POLICY "Admins can manage settings" 
ON public.admin_settings 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Users can view payment settings" 
ON public.admin_settings 
FOR SELECT 
USING (setting_key = 'payment_config');

-- Create RLS policies for order_payments
CREATE POLICY "Clients can view their own order payments" 
ON public.order_payments 
FOR SELECT 
USING (order_id IN ( SELECT orders.id FROM orders WHERE orders.client_id IN ( SELECT clients.id FROM clients WHERE clients.user_id = auth.uid())));

CREATE POLICY "Admins can manage all order payments" 
ON public.order_payments 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Order payments can be inserted for payment processing" 
ON public.order_payments 
FOR INSERT 
WITH CHECK (true);

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(EXTRACT(EPOCH FROM now())::INTEGER::TEXT, 10, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order number generation
CREATE TRIGGER generate_order_number_trigger
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();

-- Create trigger for updated_at on orders
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on admin_settings
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default payment configuration
INSERT INTO public.admin_settings (setting_key, setting_value) VALUES (
  'payment_config',
  '{
    "payment_stage": "deposit",
    "deposit_type": "percentage",
    "deposit_amount": 30,
    "currency": "GBP"
  }'::jsonb
) ON CONFLICT (setting_key) DO NOTHING;