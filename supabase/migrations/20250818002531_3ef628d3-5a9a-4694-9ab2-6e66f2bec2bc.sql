-- Create offer_status enum
CREATE TYPE offer_status AS ENUM (
  'pending',
  'accepted',
  'rejected',
  'expired'
);

-- Create job_offers table
CREATE TABLE public.job_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL REFERENCES engineers(id),
  offered_date TIMESTAMP WITH TIME ZONE NOT NULL,
  time_window TEXT,
  status offer_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  client_token TEXT NOT NULL UNIQUE,
  delivery_channel TEXT NOT NULL DEFAULT 'email',
  delivery_details JSONB DEFAULT '{}',
  rejection_reason TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add indexes for performance
CREATE INDEX idx_job_offers_order_id ON job_offers(order_id);
CREATE INDEX idx_job_offers_engineer_id ON job_offers(engineer_id);
CREATE INDEX idx_job_offers_status ON job_offers(status);
CREATE INDEX idx_job_offers_expires_at ON job_offers(expires_at);
CREATE INDEX idx_job_offers_client_token ON job_offers(client_token);

-- Enable RLS
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all job offers"
ON public.job_offers
FOR ALL
USING (is_admin());

CREATE POLICY "Engineers can view their offers"
ON public.job_offers
FOR SELECT
USING (engineer_id IN (
  SELECT e.id FROM engineers e WHERE e.user_id = auth.uid()
));

CREATE POLICY "Clients can view offers for their orders"
ON public.job_offers
FOR SELECT
USING (order_id IN (
  SELECT o.id FROM orders o
  JOIN clients c ON o.client_id = c.id
  WHERE c.user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_job_offers_updated_at
  BEFORE UPDATE ON public.job_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add is_partner_job column to orders
ALTER TABLE public.orders 
ADD COLUMN is_partner_job BOOLEAN DEFAULT false;

-- Update admin_settings with offer configuration
INSERT INTO admin_settings (setting_key, setting_value) VALUES
('offer_config', '{
  "default_ttl_hours": 24,
  "channel_priority": ["email", "sms", "whatsapp"],
  "auto_fallback_email": true,
  "templates": {
    "email_subject": "Installation Date Offered - {{order_number}}",
    "email_body": "We have an available installation slot for your order {{order_number}} on {{offered_date}} with engineer {{engineer_name}}. Please click the link to accept or reject: {{offer_url}}",
    "sms_body": "Installation slot available for order {{order_number}} on {{offered_date}}. Accept/reject: {{offer_url}}",
    "whatsapp_body": "🔧 Installation slot available for order {{order_number}} on {{offered_date}} with {{engineer_name}}. Accept/reject: {{offer_url}}"
  }
}'::jsonb)
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = now();

-- Function to generate secure client tokens
CREATE OR REPLACE FUNCTION generate_client_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- Function to check soft holds for capacity
CREATE OR REPLACE FUNCTION get_engineer_soft_holds(p_engineer_id UUID, p_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INT
    FROM job_offers
    WHERE engineer_id = p_engineer_id
      AND offered_date::date = p_date
      AND status = 'pending'
      AND expires_at > now()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enhanced workload function that includes soft holds
CREATE OR REPLACE FUNCTION get_engineer_daily_workload_with_holds(p_engineer_id UUID, p_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT 
      COALESCE(confirmed_jobs, 0) + COALESCE(soft_holds, 0)
    FROM (
      SELECT COUNT(*) as confirmed_jobs
      FROM orders
      WHERE engineer_id = p_engineer_id
        AND scheduled_install_date::date = p_date
        AND status_enhanced NOT IN ('completed')
    ) confirmed
    CROSS JOIN (
      SELECT COUNT(*) as soft_holds
      FROM job_offers
      WHERE engineer_id = p_engineer_id
        AND offered_date::date = p_date
        AND status = 'pending'
        AND expires_at > now()
    ) holds
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;