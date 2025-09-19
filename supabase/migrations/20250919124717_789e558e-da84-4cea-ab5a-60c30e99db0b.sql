-- Add quote metadata fields to orders table for partner jobs
ALTER TABLE orders ADD COLUMN quote_type text CHECK (quote_type IN ('standard', 'custom'));
ALTER TABLE orders ADD COLUMN part_required boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN groundworks_required boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN multiple_engineers_required boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN specific_engineer_required boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN specific_engineer_id uuid REFERENCES engineers(id);
ALTER TABLE orders ADD COLUMN expected_duration_days numeric CHECK (expected_duration_days IN (0.5, 1, 1.5, 2));
ALTER TABLE orders ADD COLUMN charger_model_id uuid REFERENCES inventory_items(id);

-- Add comments for documentation
COMMENT ON COLUMN orders.quote_type IS 'Type of quote: standard or custom (for partner jobs)';
COMMENT ON COLUMN orders.part_required IS 'Flag indicating if special parts are required';
COMMENT ON COLUMN orders.groundworks_required IS 'Flag indicating if groundwork is required';
COMMENT ON COLUMN orders.multiple_engineers_required IS 'Flag indicating if multiple engineers are needed';
COMMENT ON COLUMN orders.specific_engineer_required IS 'Flag indicating if a specific engineer is required';
COMMENT ON COLUMN orders.specific_engineer_id IS 'ID of the specific engineer if required';
COMMENT ON COLUMN orders.expected_duration_days IS 'Expected job duration in days (0.5, 1, 1.5, 2)';
COMMENT ON COLUMN orders.charger_model_id IS 'ID of the required charger model from inventory';