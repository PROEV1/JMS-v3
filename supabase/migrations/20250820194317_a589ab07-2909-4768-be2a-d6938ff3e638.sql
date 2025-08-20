
-- 1) Types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_location_type') THEN
    CREATE TYPE inventory_location_type AS ENUM ('warehouse', 'van', 'job_site');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_txn_type') THEN
    CREATE TYPE inventory_txn_type AS ENUM ('receive','move','consume','adjust','return','rma_out','rma_in');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_request_status') THEN
    CREATE TYPE stock_request_status AS ENUM ('submitted','approved','picked','delivered','closed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_status') THEN
    CREATE TYPE transfer_status AS ENUM ('draft','submitted','approved','picking','in_transit','delivered','closed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'po_status') THEN
    CREATE TYPE po_status AS ENUM ('draft','submitted','confirmed','partially_received','received','closed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rma_status') THEN
    CREATE TYPE rma_status AS ENUM ('open','in_transit','with_supplier','replaced','closed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_serial_status') THEN
    CREATE TYPE inventory_serial_status AS ENUM ('in_stock','installed','rma','returned');
  END IF;
END$$;

-- 2) Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  lead_time_days integer NOT NULL DEFAULT 7,
  terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers manage suppliers"
  ON public.suppliers
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
CREATE POLICY "Everyone can view suppliers"
  ON public.suppliers FOR SELECT
  USING (true);

-- 3) Inventory Items
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_serialized boolean NOT NULL DEFAULT false,
  unit text NOT NULL DEFAULT 'pcs',
  barcode text UNIQUE,
  min_level integer NOT NULL DEFAULT 0,
  max_level integer NOT NULL DEFAULT 0,
  reorder_point integer NOT NULL DEFAULT 0,
  default_cost numeric NOT NULL DEFAULT 0,
  supplier_id uuid REFERENCES public.suppliers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers manage items"
  ON public.inventory_items
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
CREATE POLICY "Everyone can view items"
  ON public.inventory_items FOR SELECT
  USING (true);

-- 4) Inventory Locations
CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location_type inventory_location_type NOT NULL,
  engineer_id uuid REFERENCES public.engineers(id),
  order_id uuid REFERENCES public.orders(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT location_engineer_only_for_van CHECK (
    (location_type <> 'van') OR (engineer_id IS NOT NULL)
  ),
  CONSTRAINT location_order_only_for_job_site CHECK (
    (location_type <> 'job_site') OR (order_id IS NOT NULL)
  )
);
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
-- Admins/managers full access
CREATE POLICY "Admins/managers manage locations"
  ON public.inventory_locations
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
-- Engineers can view warehouses, job sites, and their own van
CREATE POLICY "Engineers can view relevant locations"
  ON public.inventory_locations FOR SELECT
  USING (
    get_user_role(auth.uid()) IN ('admin','manager')
    OR location_type IN ('warehouse','job_site')
    OR engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
  );

-- 5) Inventory Serials
CREATE TABLE IF NOT EXISTS public.inventory_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  serial_number text UNIQUE NOT NULL,
  status inventory_serial_status NOT NULL DEFAULT 'in_stock',
  current_location_id uuid REFERENCES public.inventory_locations(id),
  order_id uuid REFERENCES public.orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_serials ENABLE ROW LEVEL SECURITY;
-- Admins/managers full access
CREATE POLICY "Admins/managers manage serials"
  ON public.inventory_serials
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
-- Engineers can view serials in their van or linked to their orders
CREATE POLICY "Engineers view serials in van or their orders"
  ON public.inventory_serials FOR SELECT
  USING (
    get_user_role(auth.uid()) IN ('admin','manager')
    OR current_location_id IN (
      SELECT id FROM public.inventory_locations
      WHERE location_type = 'van' AND engineer_id IN (
        SELECT id FROM public.engineers WHERE user_id = auth.uid()
      )
    )
    OR order_id IN (
      SELECT o.id FROM public.orders o
      JOIN public.engineers e ON e.id = o.engineer_id
      WHERE e.user_id = auth.uid()
    )
  );

-- 6) Inventory Transactions (immutable audit log)
CREATE TABLE IF NOT EXISTS public.inventory_txns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  txn_type inventory_txn_type NOT NULL,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  qty integer NOT NULL CHECK (qty > 0),
  serial_id uuid REFERENCES public.inventory_serials(id),
  from_location_id uuid REFERENCES public.inventory_locations(id),
  to_location_id uuid REFERENCES public.inventory_locations(id),
  order_id uuid REFERENCES public.orders(id),
  notes text
);
ALTER TABLE public.inventory_txns ENABLE ROW LEVEL SECURITY;
-- Admins/managers can do everything
CREATE POLICY "Admins/managers manage txns"
  ON public.inventory_txns
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
-- Engineers can SELECT txns relevant to their van or assigned orders
CREATE POLICY "Engineers can view their relevant txns"
  ON public.inventory_txns FOR SELECT
  USING (
    get_user_role(auth.uid()) IN ('admin','manager')
    OR from_location_id IN (
      SELECT id FROM public.inventory_locations
      WHERE location_type='van' AND engineer_id IN (
        SELECT id FROM public.engineers WHERE user_id = auth.uid()
      )
    )
    OR to_location_id IN (
      SELECT id FROM public.inventory_locations
      WHERE location_type='van' AND engineer_id IN (
        SELECT id FROM public.engineers WHERE user_id = auth.uid()
      )
    )
    OR order_id IN (
      SELECT o.id FROM public.orders o
      JOIN public.engineers e ON e.id = o.engineer_id
      WHERE e.user_id = auth.uid()
    )
  );
-- Engineers can INSERT consume from their van to an assigned order
CREATE POLICY "Engineers can consume from their van to assigned orders"
  ON public.inventory_txns FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) NOT IN ('admin','manager') AND
    txn_type = 'consume' AND
    order_id IS NOT NULL AND
    public.user_is_engineer_for_order(order_id, auth.uid()) AND
    from_location_id IN (
      SELECT id FROM public.inventory_locations
      WHERE location_type='van' AND engineer_id IN (
        SELECT id FROM public.engineers WHERE user_id = auth.uid()
      )
    )
  );

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_inventory_txns_item ON public.inventory_txns(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_txns_from_loc ON public.inventory_txns(from_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_txns_to_loc ON public.inventory_txns(to_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_serials_serial ON public.inventory_serials(serial_number);

-- 7) Stock Requests
CREATE TABLE IF NOT EXISTS public.stock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  requested_for_engineer_id uuid REFERENCES public.engineers(id),
  from_location_id uuid REFERENCES public.inventory_locations(id),
  to_location_id uuid REFERENCES public.inventory_locations(id),
  status stock_request_status NOT NULL DEFAULT 'submitted',
  needed_by date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
-- Admins/managers manage
CREATE POLICY "Admins/managers manage stock requests"
  ON public.stock_requests
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
-- Engineers can create/view their own requests
CREATE POLICY "Engineers create/view their stock requests"
  ON public.stock_requests
  FOR SELECT USING (
    requested_by = auth.uid()
    OR requested_for_engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) IN ('admin','manager')
  )
  FOR INSERT WITH CHECK (
    requested_by = auth.uid()
  );

CREATE TABLE IF NOT EXISTS public.stock_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.stock_requests(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  qty integer NOT NULL CHECK (qty > 0),
  notes text
);
ALTER TABLE public.stock_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers manage req items"
  ON public.stock_request_items
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
CREATE POLICY "Engineers view their req items"
  ON public.stock_request_items FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM public.stock_requests
      WHERE requested_by = auth.uid()
      OR requested_for_engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
      OR get_user_role(auth.uid()) IN ('admin','manager')
    )
  );

-- 8) Stock Transfers
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  from_location_id uuid NOT NULL REFERENCES public.inventory_locations(id),
  to_location_id uuid NOT NULL REFERENCES public.inventory_locations(id),
  status transfer_status NOT NULL DEFAULT 'draft',
  purpose text NOT NULL DEFAULT 'transfer', -- transfer | return | rma
  request_id uuid REFERENCES public.stock_requests(id),
  notes text
);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers manage transfers"
  ON public.stock_transfers
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
CREATE POLICY "Engineers view transfers to/from their van"
  ON public.stock_transfers FOR SELECT
  USING (
    get_user_role(auth.uid()) IN ('admin','manager')
    OR from_location_id IN (
      SELECT id FROM public.inventory_locations
      WHERE location_type='van' AND engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
    )
    OR to_location_id IN (
      SELECT id FROM public.inventory_locations
      WHERE location_type='van' AND engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
    )
  );

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  qty integer NOT NULL CHECK (qty > 0),
  notes text
);
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers manage transfer items"
  ON public.stock_transfer_items
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
CREATE POLICY "Engineers view transfer items for their transfers"
  ON public.stock_transfer_items FOR SELECT
  USING (
    transfer_id IN (
      SELECT id FROM public.stock_transfers
      WHERE get_user_role(auth.uid()) IN ('admin','manager')
         OR from_location_id IN (
            SELECT id FROM public.inventory_locations
            WHERE location_type='van' AND engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
          )
         OR to_location_id IN (
            SELECT id FROM public.inventory_locations
            WHERE location_type='van' AND engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
          )
    )
  );

-- 9) Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  status po_status NOT NULL DEFAULT 'draft',
  ordered_at timestamptz,
  expected_at date,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers manage POs"
  ON public.purchase_orders
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
CREATE POLICY "Everyone can view POs"
  ON public.purchase_orders FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  qty_ordered integer NOT NULL CHECK (qty_ordered > 0),
  qty_received integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers manage PO items"
  ON public.purchase_order_items
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
CREATE POLICY "Everyone can view PO items"
  ON public.purchase_order_items FOR SELECT
  USING (true);

-- 10) RMAs
CREATE TABLE IF NOT EXISTS public.rma_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id uuid NOT NULL REFERENCES public.inventory_serials(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  status rma_status NOT NULL DEFAULT 'open',
  reason text,
  replaced_serial_id uuid REFERENCES public.inventory_serials(id),
  opened_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rma_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers manage RMAs"
  ON public.rma_cases
  USING (get_user_role(auth.uid()) IN ('admin','manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','manager'));
CREATE POLICY "Engineers view RMAs for their serials"
  ON public.rma_cases FOR SELECT
  USING (
    get_user_role(auth.uid()) IN ('admin','manager')
    OR serial_id IN (
      SELECT s.id FROM public.inventory_serials s
      WHERE s.current_location_id IN (
        SELECT id FROM public.inventory_locations
        WHERE location_type='van' AND engineer_id IN (SELECT id FROM public.engineers WHERE user_id = auth.uid())
      )
      OR s.order_id IN (
        SELECT o.id FROM public.orders o
        JOIN public.engineers e ON e.id = o.engineer_id
        WHERE e.user_id = auth.uid()
      )
    )
  );

-- 11) Balances View (real-time, derived from txns)
CREATE OR REPLACE VIEW public.vw_item_location_balances AS
SELECT
  i.id AS item_id,
  l.id AS location_id,
  COALESCE(SUM(CASE WHEN t.to_location_id = l.id THEN t.qty ELSE 0 END),0)
  -
  COALESCE(SUM(CASE WHEN t.from_location_id = l.id THEN t.qty ELSE 0 END),0)
  AS on_hand
FROM public.inventory_items i
CROSS JOIN public.inventory_locations l
LEFT JOIN public.inventory_txns t
  ON t.item_id = i.id
  AND (t.to_location_id = l.id OR t.from_location_id = l.id)
GROUP BY i.id, l.id;

-- RLS on views is not supported; access is governed by underlying tables.

-- 12) Updated_at triggers
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT 'public.' || t::text AS tbl
    FROM unnest(ARRAY[
      'suppliers',
      'inventory_items',
      'inventory_locations',
      'inventory_serials',
      'stock_requests',
      'purchase_orders'
    ]) AS t
  LOOP
    EXECUTE format($f$
      DO $body$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = '%1$s_updated_at' AND tgrelid = '%2$s'::regclass
        ) THEN
          CREATE TRIGGER %1$s_updated_at
          BEFORE UPDATE ON %2$s
          FOR EACH ROW
          EXECUTE FUNCTION public.update_updated_at_column();
        END IF;
      END
      $body$;
    $f$, split_part(r.tbl, '.', 2) || '_row', r.tbl);
  END LOOP;
END$$;

-- 13) RPC: inv_consume (engineer "Materials Used")
CREATE OR REPLACE FUNCTION public.inv_consume(
  p_order_id uuid,
  p_from_location_id uuid,
  p_item_id uuid,
  p_qty integer,
  p_serial_ids uuid[] DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $fn$
DECLARE
  v_is_serial boolean;
  v_engineer_id uuid;
  v_txn_id uuid;
  v_needed int;
  v_id uuid;
  s uuid;
BEGIN
  -- Must be assigned engineer for the order
  IF NOT public.user_is_engineer_for_order(p_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized for order';
  END IF;

  -- From location must be this user's van
  SELECT e.id INTO v_engineer_id
  FROM public.engineers e
  WHERE e.user_id = auth.uid()
  LIMIT 1;

  IF v_engineer_id IS NULL THEN
    RAISE EXCEPTION 'Engineer profile not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_locations l
    WHERE l.id = p_from_location_id
      AND l.location_type = 'van'
      AND l.engineer_id = v_engineer_id
  ) THEN
    RAISE EXCEPTION 'Invalid from_location for this engineer';
  END IF;

  -- Item type
  SELECT is_serialized INTO v_is_serial FROM public.inventory_items WHERE id = p_item_id;
  IF v_is_serial IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  IF v_is_serial THEN
    IF p_serial_ids IS NULL OR array_length(p_serial_ids,1) IS DISTINCT FROM p_qty THEN
      RAISE EXCEPTION 'Serialized items require serial_ids matching qty';
    END IF;

    -- Validate serials and consume one-by-one
    FOREACH s IN ARRAY p_serial_ids LOOP
      -- Serial must belong to item, be in engineer van, and be in_stock
      IF NOT EXISTS (
        SELECT 1 FROM public.inventory_serials
        WHERE id = s
          AND item_id = p_item_id
          AND status = 'in_stock'
          AND current_location_id = p_from_location_id
      ) THEN
        RAISE EXCEPTION 'Serial % not available in your van for this item', s;
      END IF;

      INSERT INTO public.inventory_txns (created_by, txn_type, item_id, qty, serial_id, from_location_id, order_id, notes)
      VALUES (auth.uid(), 'consume', p_item_id, 1, s, p_from_location_id, p_order_id, p_notes)
      RETURNING id INTO v_id;

      -- Update serial to installed and detach from van
      UPDATE public.inventory_serials
      SET status = 'installed',
          current_location_id = NULL,
          order_id = p_order_id,
          updated_at = now()
      WHERE id = s;
    END LOOP;

    RETURN v_id; -- last txn id
  ELSE
    -- Bulk consumable: one txn, qty > 0
    IF p_qty IS NULL OR p_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid qty';
    END IF;

    INSERT INTO public.inventory_txns (created_by, txn_type, item_id, qty, from_location_id, order_id, notes)
    VALUES (auth.uid(), 'consume', p_item_id, p_qty, p_from_location_id, p_order_id, p_notes)
    RETURNING id INTO v_txn_id;

    RETURN v_txn_id;
  END IF;
END
$fn$;

-- Grant execute to authenticated users
REVOKE ALL ON FUNCTION public.inv_consume(uuid, uuid, uuid, integer, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inv_consume(uuid, uuid, uuid, integer, uuid[], text) TO authenticated;
