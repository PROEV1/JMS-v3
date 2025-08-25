
BEGIN;

-- 1) Dependent records
DELETE FROM public.purchase_receipts;
DELETE FROM public.purchase_order_lines;
DELETE FROM public.purchase_orders;

DELETE FROM public.returns_rma_lines;
DELETE FROM public.returns_rmas;

DELETE FROM public.stock_request_lines;
DELETE FROM public.stock_requests;

-- If you’ve logged charger shipments tied to inventory items
DELETE FROM public.charger_dispatches;

-- All inventory transactions
DELETE FROM public.inventory_txns;

-- 2) Master records
DELETE FROM public.inventory_items;
DELETE FROM public.inventory_locations;
DELETE FROM public.inventory_suppliers;

COMMIT;

-- Optional: quick counts to confirm it’s clean (non-destructive)
-- SELECT
--   (SELECT COUNT(*) FROM public.inventory_suppliers) AS suppliers,
--   (SELECT COUNT(*) FROM public.inventory_locations) AS locations,
--   (SELECT COUNT(*) FROM public.inventory_items)     AS items,
--   (SELECT COUNT(*) FROM public.inventory_txns)      AS txns,
--   (SELECT COUNT(*) FROM public.purchase_orders)     AS pos,
--   (SELECT COUNT(*) FROM public.returns_rmas)        AS rmas,
--   (SELECT COUNT(*) FROM public.stock_requests)      AS stock_requests;
