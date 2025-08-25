-- Force refresh the order status calculations for all affected orders
UPDATE orders 
SET updated_at = now()
WHERE id IN (
  SELECT o.id FROM orders o
  JOIN clients c ON o.client_id = c.id
  WHERE c.full_name IN ('Peter Harvey', 'Sophie Banham', 'Nathan Sidaway')
);