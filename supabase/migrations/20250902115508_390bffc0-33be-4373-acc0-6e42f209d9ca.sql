
-- 1) Remove all legacy/duplicate order number triggers and keep only one
DROP TRIGGER IF EXISTS generate_order_number_trigger ON public.orders;
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
DROP TRIGGER IF EXISTS orders_generate_order_number ON public.orders;
DROP TRIGGER IF EXISTS trg_generate_order_number ON public.orders;

-- 2) Ensure the sequence exists
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;

-- 3) Recreate the generator function to use the sequence only
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate on INSERT when order_number is missing/blank/TEMP
  IF TG_OP = 'INSERT' AND (NEW.order_number IS NULL OR NEW.order_number = '' OR NEW.order_number = 'TEMP') THEN
    NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('public.order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Create a single trigger that calls the function
CREATE TRIGGER orders_generate_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- 5) Realign the sequence above the maximum existing 4-digit order number (ignore epoch-style long numbers)
DO $$
DECLARE
  max_4d INTEGER := 0;
  seq_target INTEGER;
BEGIN
  -- Consider only values like 'ORDYYYY-####' (exactly 4 digits after the hyphen)
  SELECT COALESCE(MAX(CAST(split_part(order_number, '-', 2) AS INTEGER)), 0)
    INTO max_4d
  FROM public.orders
  WHERE order_number ~ '^ORD[0-9]{4}-[0-9]{4}$';

  -- Bump by a safety margin to avoid race with concurrent inserts
  seq_target := max_4d + 50;

  PERFORM setval('public.order_number_seq', seq_target, true);
  RAISE NOTICE 'Set public.order_number_seq to % (max 4-digit number was %)', seq_target, max_4d;
END $$;

-- 6) Ensure idempotent upsert key exists (safe if already present)
CREATE UNIQUE INDEX IF NOT EXISTS orders_partner_job_unique_idx
  ON public.orders (partner_id, partner_external_id)
  WHERE partner_id IS NOT NULL AND partner_external_id IS NOT NULL;
