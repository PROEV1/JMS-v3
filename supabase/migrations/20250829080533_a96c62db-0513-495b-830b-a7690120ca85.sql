-- Comprehensive stock request deletion audit with improved search patterns

CREATE OR REPLACE FUNCTION public.log_stock_request_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  related_txn_count INTEGER := 0;
  audit_log_id UUID;
  search_patterns TEXT[];
  pattern TEXT;
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
      'Stock request deleted - searching for related inventory transactions'
    )
    RETURNING id INTO audit_log_id;
    
    -- Build comprehensive search patterns
    search_patterns := ARRAY[
      'Stock request delivery: ' || OLD.id::text,
      'stock request delivery: ' || OLD.id::text,
      'Stock request #' || OLD.id::text,
      'stock request #' || OLD.id::text,
      'request #' || OLD.id::text,
      'Request #' || OLD.id::text,
      'delivery: ' || OLD.id::text,
      'Delivery: ' || OLD.id::text,
      OLD.id::text
    ];
    
    -- Find and audit any inventory transactions that reference this stock request
    -- Using multiple search approaches for maximum coverage
    INSERT INTO inventory_txn_audit (txn_id, action, old_data, performed_by, reason)
    SELECT DISTINCT
      t.id,
      'deleted'::txn_audit_action,
      to_jsonb(t),
      auth.uid(),
      'Related to deleted stock request ' || OLD.id::text || ' (status: ' || OLD.status || ', search: ' || 
      CASE 
        WHEN t.reference LIKE '%' || OLD.id::text || '%' THEN 'reference_match'
        WHEN t.notes LIKE '%' || OLD.id::text || '%' THEN 'notes_match'
        ELSE 'context_match'
      END || ')'
    FROM inventory_txns t
    WHERE (
      -- Direct UUID matching (most reliable)
      t.reference LIKE '%' || OLD.id::text || '%'
      OR t.notes LIKE '%' || OLD.id::text || '%'
      
      -- Pattern-based matching
      OR EXISTS (
        SELECT 1 FROM unnest(search_patterns) AS pattern
        WHERE t.reference ILIKE '%' || pattern || '%'
        OR t.notes ILIKE '%' || pattern || '%'
      )
      
      -- Context-based matching (same location, timeframe, and contains "request")
      OR (
        OLD.destination_location_id IS NOT NULL 
        AND t.location_id = OLD.destination_location_id
        AND t.created_at BETWEEN OLD.created_at - INTERVAL '2 hours' AND OLD.updated_at + INTERVAL '2 hours'
        AND (
          t.reference ILIKE '%request%'
          OR t.notes ILIKE '%request%'
          OR t.reference ILIKE '%delivery%'
          OR t.notes ILIKE '%delivery%'
        )
      )
      
      -- Engineer-based matching (for van stock movements)
      OR (
        OLD.engineer_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM inventory_locations il
          WHERE il.id = t.location_id
          AND il.engineer_id = OLD.engineer_id
        )
        AND t.created_at BETWEEN OLD.created_at - INTERVAL '2 hours' AND OLD.updated_at + INTERVAL '2 hours'
        AND (
          t.reference ILIKE '%request%'
          OR t.notes ILIKE '%request%'
        )
      )
    );
    
    -- Get count of related transactions found
    GET DIAGNOSTICS related_txn_count = ROW_COUNT;
    
    -- Update the deletion audit log with detailed results
    UPDATE stock_request_audit 
    SET reason = 'Stock request deleted - found and audited ' || related_txn_count || ' related inventory transactions using comprehensive search patterns'
    WHERE id = audit_log_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;