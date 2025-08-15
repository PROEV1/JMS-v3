-- Enhanced scheduling system database schema

-- Engineer working hours and availability
CREATE TABLE public.engineer_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID REFERENCES public.engineers(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Client blackout dates
CREATE TABLE public.client_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(client_id, blocked_date)
);

-- SMS notifications configuration
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  phone_number TEXT,
  reminder_48h BOOLEAN DEFAULT true,
  confirmation_immediate BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Add scheduling fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS scheduling_conflicts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS travel_time_minutes INTEGER,
ADD COLUMN IF NOT EXISTS postcode TEXT;

-- Enable RLS on new tables
ALTER TABLE public.engineer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for engineer_availability
CREATE POLICY "Admins can manage all engineer availability" 
ON public.engineer_availability 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Engineers can view their own availability" 
ON public.engineer_availability 
FOR SELECT 
USING (engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid()));

CREATE POLICY "Engineers can update their own availability" 
ON public.engineer_availability 
FOR UPDATE 
USING (engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid()));

-- RLS Policies for client_blocked_dates
CREATE POLICY "Admins can manage all blocked dates" 
ON public.client_blocked_dates 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Clients can manage their own blocked dates" 
ON public.client_blocked_dates 
FOR ALL 
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- RLS Policies for notification_preferences
CREATE POLICY "Admins can manage all notification preferences" 
ON public.notification_preferences 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Users can manage their own notification preferences" 
ON public.notification_preferences 
FOR ALL 
USING (auth.uid() = user_id);

-- Insert default availability for existing engineers (Mon-Fri 8AM-6PM)
INSERT INTO public.engineer_availability (engineer_id, day_of_week, start_time, end_time)
SELECT 
  e.id,
  dow,
  '08:00'::time,
  '18:00'::time
FROM engineers e
CROSS JOIN generate_series(1, 5) AS dow -- Monday to Friday
WHERE NOT EXISTS (
  SELECT 1 FROM engineer_availability ea WHERE ea.engineer_id = e.id
);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_engineer_availability_updated_at
BEFORE UPDATE ON public.engineer_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate engineer workload
CREATE OR REPLACE FUNCTION public.get_engineer_daily_workload(p_engineer_id UUID, p_date DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER
  FROM orders 
  WHERE engineer_id = p_engineer_id 
  AND scheduled_install_date::date = p_date
  AND status_enhanced NOT IN ('completed', 'cancelled');
$$;

-- Create function to detect scheduling conflicts
CREATE OR REPLACE FUNCTION public.detect_scheduling_conflicts(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_record RECORD;
  conflicts JSONB := '[]'::jsonb;
  conflict_item JSONB;
BEGIN
  -- Get order details
  SELECT * INTO order_record FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND OR order_record.scheduled_install_date IS NULL OR order_record.engineer_id IS NULL THEN
    RETURN conflicts;
  END IF;
  
  -- Check for double booking
  IF EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.engineer_id = order_record.engineer_id 
    AND o.id != order_record.id
    AND o.scheduled_install_date::date = order_record.scheduled_install_date::date
    AND o.status_enhanced NOT IN ('completed', 'cancelled')
  ) THEN
    conflict_item := jsonb_build_object(
      'type', 'double_booking',
      'severity', 'high',
      'message', 'Engineer has another job scheduled on this date'
    );
    conflicts := conflicts || conflict_item;
  END IF;
  
  -- Check against client blocked dates
  IF EXISTS (
    SELECT 1 FROM client_blocked_dates cbd
    WHERE cbd.client_id = order_record.client_id
    AND cbd.blocked_date = order_record.scheduled_install_date::date
  ) THEN
    conflict_item := jsonb_build_object(
      'type', 'client_blocked',
      'severity', 'high',
      'message', 'Client has blocked this date'
    );
    conflicts := conflicts || conflict_item;
  END IF;
  
  -- Check engineer availability (simplified - check if it's a weekend)
  IF EXTRACT(dow FROM order_record.scheduled_install_date) IN (0, 6) THEN
    conflict_item := jsonb_build_object(
      'type', 'outside_hours',
      'severity', 'medium',
      'message', 'Job scheduled on weekend'
    );
    conflicts := conflicts || conflict_item;
  END IF;
  
  RETURN conflicts;
END;
$$;