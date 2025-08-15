-- Add the missing 'awaiting_final_payment' value to the order_status_enhanced enum
ALTER TYPE order_status_enhanced ADD VALUE 'awaiting_final_payment';