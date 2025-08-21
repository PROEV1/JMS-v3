-- Add awaiting_final_payment to the order_status_enhanced enum to align with UI component
ALTER TYPE order_status_enhanced ADD VALUE 'awaiting_final_payment';