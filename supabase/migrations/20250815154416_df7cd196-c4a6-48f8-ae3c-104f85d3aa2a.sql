
-- 1) Align product_compatibility schema with the frontend (safe, minimal changes)

-- Rename columns to match the frontend and generated types
ALTER TABLE public.product_compatibility
  RENAME COLUMN product1_id TO core_product_id;

ALTER TABLE public.product_compatibility
  RENAME COLUMN product2_id TO accessory_product_id;

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS idx_product_compatibility_core
  ON public.product_compatibility (core_product_id);

CREATE INDEX IF NOT EXISTS idx_product_compatibility_accessory
  ON public.product_compatibility (accessory_product_id);

-- Add foreign keys to products(id); create NOT VALID first to avoid locking, then validate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_compatibility_core_product_id_fkey'
  ) THEN
    ALTER TABLE public.product_compatibility
      ADD CONSTRAINT product_compatibility_core_product_id_fkey
      FOREIGN KEY (core_product_id) REFERENCES public.products(id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_compatibility_accessory_product_id_fkey'
  ) THEN
    ALTER TABLE public.product_compatibility
      ADD CONSTRAINT product_compatibility_accessory_product_id_fkey
      FOREIGN KEY (accessory_product_id) REFERENCES public.products(id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END$$;

ALTER TABLE public.product_compatibility
  VALIDATE CONSTRAINT product_compatibility_core_product_id_fkey;

ALTER TABLE public.product_compatibility
  VALIDATE CONSTRAINT product_compatibility_accessory_product_id_fkey;

-- 2) Unblock installers table by adding an admin-only policy (RLS already enabled)
-- This ensures future reads/writes by admins won’t be silently blocked
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installers'
      AND policyname = 'Admins can manage all installers'
  ) THEN
    CREATE POLICY "Admins can manage all installers"
      ON public.installers
      FOR ALL
      USING (get_user_role(auth.uid()) = 'admin'::user_role)
      WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);
  END IF;
END$$;
