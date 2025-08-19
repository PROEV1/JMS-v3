
-- 1) Allow partner clients without a linked auth user
ALTER TABLE public.clients
  ALTER COLUMN user_id DROP NOT NULL;

-- 2) Drop the FK to avoid requiring an auth user for partner clients
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_user_id_fkey;

-- 3) Ensure sequences exist for quote and order numbers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'quote_number_seq'
  ) THEN
    CREATE SEQUENCE public.quote_number_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'order_number_seq'
  ) THEN
    CREATE SEQUENCE public.order_number_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
  END IF;
END
$$;

-- 4) Attach triggers to auto-generate numbers on INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_quote_number'
  ) THEN
    CREATE TRIGGER trg_generate_quote_number
    BEFORE INSERT ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_quote_number();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_order_number'
  ) THEN
    CREATE TRIGGER trg_generate_order_number
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_order_number();
  END IF;
END
$$;
