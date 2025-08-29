-- Add item_name column to purchase_order_lines table for easier reference
ALTER TABLE public.purchase_order_lines 
ADD COLUMN item_name text;

-- Update existing records to populate the item_name from inventory_items
UPDATE public.purchase_order_lines 
SET item_name = i.name
FROM public.inventory_items i 
WHERE purchase_order_lines.item_id = i.id;