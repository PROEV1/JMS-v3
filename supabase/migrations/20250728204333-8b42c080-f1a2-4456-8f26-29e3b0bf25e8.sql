-- Add starting postcode to engineers table
ALTER TABLE engineers ADD COLUMN starting_postcode TEXT;

-- Create engineer time off table for holidays/sick days
CREATE TABLE engineer_time_off (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id UUID NOT NULL REFERENCES engineers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  approved_by UUID REFERENCES profiles(user_id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create engineer service areas table
CREATE TABLE engineer_service_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id UUID NOT NULL REFERENCES engineers(id) ON DELETE CASCADE,
  postcode_area TEXT NOT NULL,
  max_travel_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE engineer_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineer_service_areas ENABLE ROW LEVEL SECURITY;

-- RLS policies for engineer_time_off
CREATE POLICY "Admins can manage all engineer time off" 
ON engineer_time_off 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Engineers can manage their own time off" 
ON engineer_time_off 
FOR ALL 
USING (engineer_id IN (
  SELECT id FROM engineers WHERE user_id = auth.uid()
));

-- RLS policies for engineer_service_areas
CREATE POLICY "Admins can manage all engineer service areas" 
ON engineer_service_areas 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Engineers can manage their own service areas" 
ON engineer_service_areas 
FOR ALL 
USING (engineer_id IN (
  SELECT id FROM engineers WHERE user_id = auth.uid()
));

-- Add trigger for updated_at on engineer_time_off
CREATE TRIGGER update_engineer_time_off_updated_at
  BEFORE UPDATE ON engineer_time_off
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();