-- Improve stock request deletion audit tracking to better find related transactions

CREATE OR REPLACE FUNCTION public.log_stock_request_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  related_txn_count INTEGER := 0;
  audit_record_id UUID;
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
    -- When deleting a stock request, first log the deletion
    INSERT INTO stock_request_audit (request_id, action, old_data, performed_by, reason)
    VALUES (
      OLD.id, 
      'deleted', 
      to_jsonb(OLD), 
      auth.uid(),
      'Stock request deleted - will audit related inventory transactions'
    ) RETURNING id INTO audit_record_id;
    
    -- Find and audit any inventory transactions that reference this stock request
    -- Look for multiple patterns in both reference and notes fields
    INSERT INTO inventory_txn_audit (txn_id, action, old_data, performed_by, reason)
    SELECT 
      t.id,
      'deleted'::txn_audit_action,
      to_jsonb(t),
      auth.uid(),
      'Related to deleted stock request ' || OLD.id::text || ' (status: ' || OLD.status || ')'
    FROM inventory_txns t
    WHERE (
      -- Match the exact stock request ID in various formats
      t.reference LIKE '%' || OLD.id::text || '%'
      OR t.notes LIKE '%' || OLD.id::text || '%'
      OR t.reference LIKE '%delivery: ' || OLD.id::text || '%'
      OR t.notes LIKE '%request #' || OLD.id::text || '%'
      -- Also check for transactions created around the same time for this engineer/location
      OR (
        OLD.engineer_id IS NOT NULL 
        AND t.created_at BETWEEN OLD.created_at - INTERVAL '1 hour' AND OLD.updated_at + INTERVAL '1 hour'
        AND t.location_id = OLD.destination_location_id
        AND (t.reference LIKE '%request%' OR t.notes LIKE '%request%')
      )
    );
    
    -- Get count of related transactions found
    GET DIAGNOSTICS related_txn_count = ROW_COUNT;
    
    -- Update the deletion audit log with the count of related transactions
    UPDATE stock_request_audit 
    SET reason = 'Stock request deleted - audited ' || related_txn_count || ' related inventory transactions'
    WHERE id = audit_record_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Run the retroactive audit function to catch any existing orphaned transactions
SELECT * FROM audit_orphaned_inventory_transactions();