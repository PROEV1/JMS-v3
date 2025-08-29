-- Fix inventory transaction audit tracking
-- First, drop the existing trigger if it exists
DROP TRIGGER IF EXISTS log_inventory_txn_audit_trigger ON inventory_txns;

-- Update the audit function to properly handle all operations
CREATE OR REPLACE FUNCTION public.log_inventory_txn_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO inventory_txn_audit (txn_id, action, new_data, performed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), COALESCE(auth.uid(), NEW.created_by));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO inventory_txn_audit (txn_id, action, old_data, new_data, performed_by)
      VALUES (
        NEW.id, 
        CASE 
          WHEN NEW.status = 'approved' THEN 'approved'::txn_audit_action
          WHEN NEW.status = 'rejected' THEN 'rejected'::txn_audit_action
          ELSE 'modified'::txn_audit_action
        END,
        jsonb_build_object('status', OLD.status, 'approved_by', OLD.approved_by, 'approved_at', OLD.approved_at, 'rejection_reason', OLD.rejection_reason),
        jsonb_build_object('status', NEW.status, 'approved_by', NEW.approved_by, 'approved_at', NEW.approved_at, 'rejection_reason', NEW.rejection_reason),
        COALESCE(auth.uid(), NEW.approved_by)
      );
    ELSE
      -- Log other modifications
      INSERT INTO inventory_txn_audit (txn_id, action, old_data, new_data, performed_by)
      VALUES (NEW.id, 'modified', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO inventory_txn_audit (txn_id, action, old_data, performed_by)
    VALUES (OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Create the trigger for all operations
CREATE TRIGGER log_inventory_txn_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON inventory_txns
  FOR EACH ROW EXECUTE FUNCTION log_inventory_txn_audit();

-- Backfill audit entries for existing transactions that don't have them
INSERT INTO inventory_txn_audit (txn_id, action, new_data, performed_by, performed_at)
SELECT 
  t.id,
  'created'::txn_audit_action,
  to_jsonb(t),
  t.created_by,
  t.created_at
FROM inventory_txns t
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_txn_audit 
  WHERE txn_id = t.id AND action = 'created'
)
ORDER BY t.created_at;