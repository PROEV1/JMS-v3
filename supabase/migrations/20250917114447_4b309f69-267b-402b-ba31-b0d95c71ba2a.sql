-- Create calendar_items table for non-job activities like parts, training, time off, etc.
CREATE TABLE public.calendar_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id UUID REFERENCES public.engineers(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('parts', 'training', 'time_off', 'maintenance', 'meeting', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN NOT NULL DEFAULT true,
  color TEXT DEFAULT '#3b82f6',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.calendar_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage all calendar items" 
ON public.calendar_items 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Engineers can view their own calendar items" 
ON public.calendar_items 
FOR SELECT 
USING (
  engineer_id IN (
    SELECT id FROM engineers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Engineers can create their own calendar items" 
ON public.calendar_items 
FOR INSERT 
WITH CHECK (
  created_by = auth.uid() AND
  engineer_id IN (
    SELECT id FROM engineers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Engineers can update their own calendar items" 
ON public.calendar_items 
FOR UPDATE 
USING (
  engineer_id IN (
    SELECT id FROM engineers WHERE user_id = auth.uid()
  )
) 
WITH CHECK (
  engineer_id IN (
    SELECT id FROM engineers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Engineers can delete their own calendar items" 
ON public.calendar_items 
FOR DELETE 
USING (
  engineer_id IN (
    SELECT id FROM engineers WHERE user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_calendar_items_engineer_date ON public.calendar_items(engineer_id, start_date);
CREATE INDEX idx_calendar_items_date_range ON public.calendar_items(start_date, end_date);