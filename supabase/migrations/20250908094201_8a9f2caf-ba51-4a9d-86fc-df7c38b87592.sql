-- Update Christopher Smith to 4 hours and Christopher Vernon Alexander to 5 hours
UPDATE orders 
SET estimated_duration_hours = 4 
WHERE order_number = 'ORD2025-039788';

UPDATE orders 
SET estimated_duration_hours = 5 
WHERE order_number = 'ORD2025-039789';