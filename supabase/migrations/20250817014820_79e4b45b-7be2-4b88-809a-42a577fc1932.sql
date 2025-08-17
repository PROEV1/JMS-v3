-- Add new status values to order_status_enhanced enum
ALTER TYPE order_status_enhanced ADD VALUE IF NOT EXISTS 'needs_scheduling';
ALTER TYPE order_status_enhanced ADD VALUE IF NOT EXISTS 'date_offered';
ALTER TYPE order_status_enhanced ADD VALUE IF NOT EXISTS 'date_accepted';
ALTER TYPE order_status_enhanced ADD VALUE IF NOT EXISTS 'date_rejected';
ALTER TYPE order_status_enhanced ADD VALUE IF NOT EXISTS 'offer_expired';
ALTER TYPE order_status_enhanced ADD VALUE IF NOT EXISTS 'on_hold_parts_docs';
ALTER TYPE order_status_enhanced ADD VALUE IF NOT EXISTS 'cancelled';