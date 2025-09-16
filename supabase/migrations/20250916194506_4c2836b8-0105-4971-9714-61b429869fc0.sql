-- Create the missing charger in inventory for serial number 041500007229
-- First, get the Ohme Home Pro 5m charger item ID
INSERT INTO charger_inventory (
  charger_item_id,
  serial_number,
  status,
  engineer_id,
  notes,
  assigned_order_id
) VALUES (
  (SELECT id FROM inventory_items WHERE name = 'Ohme Home Pro 5m' AND is_charger = true LIMIT 1),
  '041500007229',
  'deployed',
  '09d21304-4dbc-4e8b-b986-496425b707ad',
  'Used on order: 9a732d5c-d007-4a5a-8df5-f9d9cb989b00',
  '9a732d5c-d007-4a5a-8df5-f9d9cb989b00'
);

-- Update the engineer_materials_used record to link to the charger inventory
UPDATE engineer_materials_used 
SET charger_inventory_id = (
  SELECT id FROM charger_inventory WHERE serial_number = '041500007229' LIMIT 1
),
item_id = (
  SELECT id FROM inventory_items WHERE name = 'Ohme Home Pro 5m' AND is_charger = true LIMIT 1
)
WHERE serial_number = '041500007229';