-- Add comprehensive audit tracking for stock requests and related transactions

-- Create audit table for stock requests (if not exists)
CREATE TABLE IF NOT EXISTS public.stock_request_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'status_changed')),
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  performed_by UUID,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_stock_request_audit_request_id ON stock_request_audit(request_id);
CREATE INDEX IF NOT EXISTS idx_stock_request_audit_performed_at ON stock_request_audit(performed_at);

-- Enable RLS
ALTER TABLE stock_request_audit ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Admins can view all stock request audit logs" ON stock_request_audit;
DROP POLICY IF EXISTS "Admins can create stock request audit logs" ON stock_request_audit;

CREATE POLICY "Admins can view all stock request audit logs"
  ON stock_request_audit FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can create stock request audit logs"
  ON stock_request_audit FOR INSERT
  WITH CHECK (is_admin());

-- Create audit function for stock requests
CREATE OR REPLACE FUNCTION public.log_stock_request_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO stock_request_audit (request_id, action, new_data, performed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes specifically
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO stock_request_audit (request_id, action, old_data, new_data, performed_by)
      VALUES (
        NEW.id, 
        'status_changed',
        jsonb_build_object('status', OLD.status, 'updated_at', OLD.updated_at),
        jsonb_build_object('status', NEW.status, 'updated_at', NEW.updated_at),
        auth.uid()
      );
    ELSE
      -- Log other updates
      INSERT INTO stock_request_audit (request_id, action, old_data, new_data, performed_by)
      VALUES (NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- When deleting a stock request, also audit any related inventory transactions
    INSERT INTO stock_request_audit (request_id, action, old_data, performed_by, reason)
    VALUES (
      OLD.id, 
      'deleted', 
      to_jsonb(OLD), 
      auth.uid(),
      'Stock request deleted - related inventory transactions may be affected'
    );
    
    -- Also audit any inventory transactions that reference this stock request
    INSERT INTO inventory_txn_audit (txn_id, action, old_data, performed_by, reason)
    SELECT 
      t.id,
      'deleted'::txn_audit_action,
      to_jsonb(t),
      auth.uid(),
      'Parent stock request ' || OLD.id::text || ' was deleted'
    FROM inventory_txns t
    WHERE t.reference LIKE '%' || OLD.id::text || '%'
      OR t.notes LIKE '%' || OLD.id::text || '%';
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Create triggers for stock requests
DROP TRIGGER IF EXISTS log_stock_request_audit_trigger ON stock_requests;
CREATE TRIGGER log_stock_request_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON stock_requests
  FOR EACH ROW EXECUTE FUNCTION log_stock_request_audit();