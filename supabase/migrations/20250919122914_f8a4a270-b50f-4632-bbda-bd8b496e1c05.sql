-- Add new quote metadata fields for enhanced quoting
ALTER TABLE quotes ADD COLUMN quote_type text CHECK (quote_type IN ('standard', 'custom'));
ALTER TABLE quotes ADD COLUMN part_required boolean DEFAULT false;
ALTER TABLE quotes ADD COLUMN groundworks_required boolean DEFAULT false;
ALTER TABLE quotes ADD COLUMN multiple_engineers_required boolean DEFAULT false;
ALTER TABLE quotes ADD COLUMN specific_engineer_required boolean DEFAULT false;
ALTER TABLE quotes ADD COLUMN specific_engineer_id uuid REFERENCES engineers(id);
ALTER TABLE quotes ADD COLUMN expected_duration_days numeric CHECK (expected_duration_days IN (0.5, 1, 1.5, 2));
ALTER TABLE quotes ADD COLUMN charger_model_id uuid REFERENCES inventory_items(id);
ALTER TABLE quotes ADD COLUMN partner_id uuid;

-- Add comments for documentation
COMMENT ON COLUMN quotes.quote_type IS 'Type of quote: standard or custom';
COMMENT ON COLUMN quotes.part_required IS 'Flag indicating if special parts are required';
COMMENT ON COLUMN quotes.groundworks_required IS 'Flag indicating if groundwork is required';
COMMENT ON COLUMN quotes.multiple_engineers_required IS 'Flag indicating if multiple engineers are needed';
COMMENT ON COLUMN quotes.specific_engineer_required IS 'Flag indicating if a specific engineer is required';
COMMENT ON COLUMN quotes.specific_engineer_id IS 'ID of the specific engineer if required';
COMMENT ON COLUMN quotes.expected_duration_days IS 'Expected job duration in days (0.5, 1, 1.5, 2)';
COMMENT ON COLUMN quotes.charger_model_id IS 'ID of the required charger model from inventory';
COMMENT ON COLUMN quotes.partner_id IS 'Partner ID for partner jobs (future use)';