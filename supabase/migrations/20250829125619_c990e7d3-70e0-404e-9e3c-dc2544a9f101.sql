-- Update existing 'delivered' status records to 'cancelled' since we removed delivered status
UPDATE public.stock_requests 
SET status = 'cancelled', 
    notes = COALESCE(notes, '') || 
    CASE 
        WHEN notes IS NULL OR notes = '' 
        THEN 'Status updated from delivered to cancelled due to system changes'
        ELSE ' | Status updated from delivered to cancelled due to system changes'
    END,
    updated_at = now()
WHERE status = 'delivered';