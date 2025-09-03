
-- 1) Remove all legacy order-number triggers (keep only one clean trigger later)
DROP TRIGGER IF EXISTS generate_order_number_trigger ON public.orders;
DROP TRIGGER IF EXISTS orders_generate_order_number ON public.orders;
DROP TRIGGER IF EXISTS trg_generate_order_number ON public.orders;
DROP TRIGGER IF EXISTS trigger_generate_order_number ON public.orders;
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
DROP TRIGGER IF EXISTS set_order_number_trigger ON public.orders;

-- 2) Drop any legacy function versions
DROP FUNCTION IF EXISTS public.generate_order_number();
DROP FUNCTION IF EXISTS generate_order_number();

-- 3) Ensure the sequence exists
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;

-- 4) Realign the sequence to a safe value above existing orders
--    Extract the numeric block right after 'ORDYYYY-', ignoring any trailing suffixes
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(
           MAX(
             CAST(
               regexp_replace(order_number, '^ORD[0-9]{4}-([0-9]{1,6}).*$', '\1')
               AS INTEGER
             )
           ),
           0
         ) + 100
  INTO max_num
  FROM public.orders
  WHERE order_number ~ '^ORD[0-9]{4}-[0-9]{1,6}';

  PERFORM setval('public.order_number_seq', GREATEST(1, max_num), true);
END $$;

-- 5) Recreate the generator function: single sequence source, fixed format
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.order_number IS NULL OR NEW.order_number = '' OR NEW.order_number = 'TEMP') THEN
    NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' ||
                        LPAD(nextval('public.order_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

-- 6) Create a single trigger that calls the function
CREATE TRIGGER orders_generate_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- 7) Ensure idempotency key for partner imports (safe if already present)
CREATE UNIQUE INDEX IF NOT EXISTS orders_partner_job_unique_idx
  ON public.orders (partner_id, partner_external_id)
  WHERE partner_id IS NOT NULL AND partner_external_id IS NOT NULL;
