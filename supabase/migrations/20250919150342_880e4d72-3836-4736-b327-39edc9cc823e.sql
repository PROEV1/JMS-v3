-- Allow custom items in purchase order lines by making item_id nullable
ALTER TABLE public.purchase_order_lines 
ALTER COLUMN item_id DROP NOT NULL;

-- Add a comment to explain the nullable item_id
COMMENT ON COLUMN public.purchase_order_lines.item_id IS 'References inventory_items for standard items, null for custom items. Use item_name for custom items.';