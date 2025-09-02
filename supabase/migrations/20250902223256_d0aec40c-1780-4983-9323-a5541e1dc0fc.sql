-- Fix orphaned partner client cleanup
-- Add a function to clean up orphaned partner clients and improve the deletion process

-- Function to clean up orphaned partner clients
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_partner_clients(p_partner_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  deleted_count integer := 0;
  client_ids_to_delete uuid[];
BEGIN
  -- Find orphaned partner clients (those with no orders)
  SELECT ARRAY_AGG(c.id) INTO client_ids_to_delete
  FROM clients c
  LEFT JOIN orders o ON c.id = o.client_id
  WHERE c.is_partner_client = true
    AND (p_partner_id IS NULL OR c.partner_id = p_partner_id)
    AND o.id IS NULL; -- No orders exist for this client
  
  -- Delete orphaned clients if any found
  IF client_ids_to_delete IS NOT NULL AND array_length(client_ids_to_delete, 1) > 0 THEN
    DELETE FROM clients 
    WHERE id = ANY(client_ids_to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % orphaned partner clients', deleted_count;
  END IF;
  
  RETURN deleted_count;
END;
$function$;

-- Function to safely delete all partner data with proper cleanup
CREATE OR REPLACE FUNCTION public.delete_partner_data_safe(p_partner_id uuid, p_import_run_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  order_ids uuid[];
  client_ids_from_orders uuid[];
  deleted_stats jsonb := '{}';
  temp_count integer;
BEGIN
  -- Get all order IDs to delete
  IF p_import_run_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id), ARRAY_AGG(client_id) 
    INTO order_ids, client_ids_from_orders
    FROM orders 
    WHERE partner_metadata->>'import_run_id' = p_import_run_id;
  ELSE
    SELECT ARRAY_AGG(id), ARRAY_AGG(client_id) 
    INTO order_ids, client_ids_from_orders
    FROM orders 
    WHERE is_partner_job = true AND partner_id = p_partner_id;
  END IF;
  
  -- Initialize stats
  deleted_stats := jsonb_build_object(
    'orders', 0,
    'job_offers', 0,
    'order_activity', 0,
    'order_completion_checklist', 0,
    'engineer_uploads', 0,
    'order_payments', 0,
    'quotes', 0,
    'clients', 0
  );
  
  -- If we have orders to delete, delete them and related data
  IF order_ids IS NOT NULL AND array_length(order_ids, 1) > 0 THEN
    
    -- Delete job offers
    DELETE FROM job_offers WHERE order_id = ANY(order_ids);
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_stats := jsonb_set(deleted_stats, '{job_offers}', to_jsonb(temp_count));
    
    -- Delete order activity
    DELETE FROM order_activity WHERE order_id = ANY(order_ids);
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_stats := jsonb_set(deleted_stats, '{order_activity}', to_jsonb(temp_count));
    
    -- Delete completion checklist
    DELETE FROM order_completion_checklist WHERE order_id = ANY(order_ids);
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_stats := jsonb_set(deleted_stats, '{order_completion_checklist}', to_jsonb(temp_count));
    
    -- Delete engineer uploads
    DELETE FROM engineer_uploads WHERE order_id = ANY(order_ids);
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_stats := jsonb_set(deleted_stats, '{engineer_uploads}', to_jsonb(temp_count));
    
    -- Delete order payments
    DELETE FROM order_payments WHERE order_id = ANY(order_ids);
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_stats := jsonb_set(deleted_stats, '{order_payments}', to_jsonb(temp_count));
    
    -- Delete quotes for affected clients
    IF client_ids_from_orders IS NOT NULL AND array_length(client_ids_from_orders, 1) > 0 THEN
      DELETE FROM quotes WHERE client_id = ANY(client_ids_from_orders);
      GET DIAGNOSTICS temp_count = ROW_COUNT;
      deleted_stats := jsonb_set(deleted_stats, '{quotes}', to_jsonb(temp_count));
    END IF;
    
    -- Delete the orders themselves
    DELETE FROM orders WHERE id = ANY(order_ids);
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_stats := jsonb_set(deleted_stats, '{orders}', to_jsonb(temp_count));
    
    -- Delete orphaned clients (clients that no longer have any orders)
    DELETE FROM clients 
    WHERE id = ANY(client_ids_from_orders)
      AND NOT EXISTS (SELECT 1 FROM orders WHERE client_id = clients.id);
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_stats := jsonb_set(deleted_stats, '{clients}', to_jsonb(temp_count));
  END IF;
  
  -- Clean up any remaining orphaned partner clients
  temp_count := cleanup_orphaned_partner_clients(p_partner_id);
  deleted_stats := jsonb_set(deleted_stats, '{clients}', 
    to_jsonb((deleted_stats->>'clients')::integer + temp_count));
  
  RETURN deleted_stats;
END;
$function$;

-- Clean up existing orphaned partner clients
SELECT cleanup_orphaned_partner_clients();