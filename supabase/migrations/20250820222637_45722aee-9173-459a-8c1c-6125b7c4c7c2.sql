-- Add is_charger column to inventory_items if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'inventory_items' 
                  AND column_name = 'is_charger') THEN
        ALTER TABLE public.inventory_items 
        ADD COLUMN is_charger boolean NOT NULL DEFAULT false;
    END IF;
END $$;