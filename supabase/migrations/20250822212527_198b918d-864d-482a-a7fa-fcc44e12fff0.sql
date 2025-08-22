-- Force recalculation of status_enhanced for all partner jobs
-- The triggers aren't working properly during import, so we need to manually fix this

UPDATE orders 
SET status_enhanced = public.calculate_order_status_final(orders.*),
    updated_at = NOW()
WHERE is_partner_job = true;

-- Also ensure the trigger is properly attached
DROP TRIGGER IF EXISTS orders_before_set_status_enhanced ON public.orders;
CREATE TRIGGER orders_before_set_status_enhanced
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_set_status_enhanced();