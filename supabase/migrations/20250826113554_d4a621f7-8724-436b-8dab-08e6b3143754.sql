-- Fix order ORD2024-2235 that's stuck due to manual override preventing status calculation
UPDATE orders 
SET manual_status_override = false, 
    manual_status_notes = null 
WHERE order_number = 'ORD2024-2235' 
  AND manual_status_override = true;