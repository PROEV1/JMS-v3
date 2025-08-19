-- Force recalculation of status_enhanced for all orders to apply the new offer-aware logic
UPDATE orders SET updated_at = NOW();