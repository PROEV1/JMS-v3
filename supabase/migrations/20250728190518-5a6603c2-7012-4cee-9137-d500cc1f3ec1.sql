-- Create engineer audit archive table to preserve work history when jobs are rescheduled
CREATE TABLE public.engineer_audit_archive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  engineer_id UUID,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reset_reason TEXT NOT NULL, -- 'rescheduled', 'engineer_changed', etc.
  reset_by UUID, -- admin who triggered the reset
  
  -- Archived engineer work data
  engineer_notes TEXT,
  engineer_signature_data TEXT,
  engineer_status TEXT,
  engineer_signed_off_at TIMESTAMP WITH TIME ZONE,
  
  -- Archived checklist state
  checklist_items JSONB DEFAULT '[]'::jsonb,
  
  -- Archived uploads info (references, not files themselves)
  uploads_snapshot JSONB DEFAULT '[]'::jsonb,
  
  -- Additional context
  scheduled_date_before TIMESTAMP WITH TIME ZONE,
  scheduled_date_after TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.engineer_audit_archive ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all engineer audit archives" 
ON public.engineer_audit_archive 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Engineers can view their own archived work" 
ON public.engineer_audit_archive 
FOR SELECT 
USING (engineer_id IN (
  SELECT engineers.id 
  FROM engineers 
  WHERE engineers.user_id = auth.uid()
));

-- Add index for performance
CREATE INDEX idx_engineer_audit_archive_order_id ON public.engineer_audit_archive(order_id);
CREATE INDEX idx_engineer_audit_archive_engineer_id ON public.engineer_audit_archive(engineer_id);

-- Add archive function for reusability
CREATE OR REPLACE FUNCTION public.archive_engineer_work(
  p_order_id UUID,
  p_reset_reason TEXT,
  p_reset_by UUID DEFAULT NULL,
  p_scheduled_date_after TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  archive_id UUID;
  order_record RECORD;
  checklist_data JSONB;
  uploads_data JSONB;
BEGIN
  -- Get current order state
  SELECT * INTO order_record FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  
  -- Get current checklist items
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'item_id', item_id,
      'item_label', item_label,
      'item_description', item_description,
      'is_completed', is_completed,
      'completed_at', completed_at
    )
  ), '[]'::jsonb) INTO checklist_data
  FROM order_completion_checklist 
  WHERE order_id = p_order_id;
  
  -- Get current uploads info
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'upload_type', upload_type,
      'file_name', file_name,
      'file_url', file_url,
      'description', description,
      'uploaded_at', uploaded_at
    )
  ), '[]'::jsonb) INTO uploads_data
  FROM engineer_uploads 
  WHERE order_id = p_order_id;
  
  -- Create archive record
  INSERT INTO engineer_audit_archive (
    order_id,
    engineer_id,
    reset_reason,
    reset_by,
    engineer_notes,
    engineer_signature_data,
    engineer_status,
    engineer_signed_off_at,
    checklist_items,
    uploads_snapshot,
    scheduled_date_before,
    scheduled_date_after
  ) VALUES (
    p_order_id,
    order_record.engineer_id,
    p_reset_reason,
    COALESCE(p_reset_by, auth.uid()),
    order_record.engineer_notes,
    order_record.engineer_signature_data,
    order_record.engineer_status,
    order_record.engineer_signed_off_at,
    checklist_data,
    uploads_data,
    order_record.scheduled_install_date,
    p_scheduled_date_after
  ) RETURNING id INTO archive_id;
  
  RETURN archive_id;
END;
$function$;