-- Add order_id to quotes table to link quotes to orders
ALTER TABLE quotes ADD COLUMN order_id uuid REFERENCES orders(id);

-- Create table to store quote snapshots
CREATE TABLE order_quote_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('original', 'revision')),
  quote_data jsonb NOT NULL,
  html_content text,
  pdf_url text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE order_quote_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for order_quote_snapshots
CREATE POLICY "Admins can manage all quote snapshots"
ON order_quote_snapshots FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Clients can view snapshots for their orders"
ON order_quote_snapshots FOR SELECT
USING (
  order_id IN (
    SELECT o.id FROM orders o
    JOIN clients c ON o.client_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Engineers can view snapshots for their orders"
ON order_quote_snapshots FOR SELECT
USING (
  order_id IN (
    SELECT o.id FROM orders o
    JOIN engineers e ON o.engineer_id = e.id
    WHERE e.user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_order_quote_snapshots_order_id ON order_quote_snapshots(order_id);
CREATE INDEX idx_order_quote_snapshots_quote_id ON order_quote_snapshots(quote_id);