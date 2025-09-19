-- Add parts_delivered column to track when parts arrive
ALTER TABLE public.orders 
ADD COLUMN parts_delivered BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN public.orders.parts_delivered IS 'Tracks when ordered parts have been delivered/received';