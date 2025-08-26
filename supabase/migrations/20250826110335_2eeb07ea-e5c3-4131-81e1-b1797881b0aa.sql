
-- 1) Keep order status in sync when job_offers change
DROP TRIGGER IF EXISTS trg_update_order_status_on_offer_change ON public.job_offers;
CREATE TRIGGER trg_update_order_status_on_offer_change
AFTER INSERT OR UPDATE OR DELETE ON public.job_offers
FOR EACH ROW EXECUTE FUNCTION public.update_order_status_on_offer_change();

-- 2) Orders: compute status_enhanced and updated_at automatically
DROP TRIGGER IF EXISTS trg_orders_set_status_enhanced ON public.orders;
CREATE TRIGGER trg_orders_set_status_enhanced
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_set_status_enhanced();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Orders: log status changes
DROP TRIGGER IF EXISTS trg_log_order_status_change ON public.orders;
CREATE TRIGGER trg_log_order_status_change
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- 4) Orders: expire pending offers when scheduled or reset
DROP TRIGGER IF EXISTS trg_expire_pending_offers_on_schedule ON public.orders;
CREATE TRIGGER trg_expire_pending_offers_on_schedule
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.expire_pending_offers_on_schedule();

DROP TRIGGER IF EXISTS trg_expire_offers_on_order_reset ON public.orders;
CREATE TRIGGER trg_expire_offers_on_order_reset
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.expire_offers_on_order_reset();

-- 5) Orders: generate order number on insert
DROP TRIGGER IF EXISTS trg_generate_order_number ON public.orders;
CREATE TRIGGER trg_generate_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- 6) Quotes and Surveys: keep status in sync when related records change
DROP TRIGGER IF EXISTS trg_update_order_status_on_quote_change ON public.quotes;
CREATE TRIGGER trg_update_order_status_on_quote_change
AFTER INSERT OR UPDATE OR DELETE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.update_order_status_on_quote_change();

DROP TRIGGER IF EXISTS trg_update_order_status_on_survey_change ON public.client_surveys;
CREATE TRIGGER trg_update_order_status_on_survey_change
AFTER INSERT OR UPDATE OR DELETE ON public.client_surveys
FOR EACH ROW EXECUTE FUNCTION public.update_order_status_on_survey_change();
