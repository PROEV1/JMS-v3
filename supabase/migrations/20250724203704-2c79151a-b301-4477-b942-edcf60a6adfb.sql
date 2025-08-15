-- Update orders to have correct deposit amounts based on admin config
UPDATE orders 
SET deposit_amount = CASE 
  WHEN total_amount > 0 THEN ROUND(total_amount * 0.25) 
  ELSE 0 
END
WHERE deposit_amount = 0 AND total_amount > 0;

-- Update quotes to have correct deposit amounts based on admin config  
UPDATE quotes
SET deposit_required = CASE 
  WHEN total_cost > 0 THEN ROUND(total_cost * 0.25)
  ELSE 0
END
WHERE deposit_required = 0 AND total_cost > 0;