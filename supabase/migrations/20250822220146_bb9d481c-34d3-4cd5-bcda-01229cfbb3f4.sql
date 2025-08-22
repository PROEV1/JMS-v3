-- Phone number normalization backfill
-- This migration fixes existing phone numbers that may be in scientific notation or incorrect format

-- Create a temporary function to normalize phone numbers
CREATE OR REPLACE FUNCTION normalize_phone_number(phone_input text)
RETURNS text AS $$
DECLARE
  normalized_phone text;
  digits_only text;
BEGIN
  -- Return null for empty or null input
  IF phone_input IS NULL OR trim(phone_input) = '' THEN
    RETURN NULL;
  END IF;

  normalized_phone := phone_input;

  -- Handle scientific notation (e.g., "4.41234567891E12" -> "441234567891")
  IF normalized_phone ~ '[eE]' THEN
    BEGIN
      -- Convert scientific notation to regular number string
      normalized_phone := CAST(CAST(normalized_phone AS numeric) AS text);
    EXCEPTION WHEN OTHERS THEN
      -- If conversion fails, proceed with original value
      NULL;
    END;
  END IF;

  -- Remove all non-digit characters
  digits_only := regexp_replace(normalized_phone, '[^0-9]', '', 'g');
  
  -- Return null if no digits found
  IF digits_only = '' THEN
    RETURN NULL;
  END IF;

  -- Handle UK phone numbers
  IF digits_only ~ '^44' AND length(digits_only) > 11 THEN
    -- Convert 44XXXXXXXXXX to 0XXXXXXXXXX (UK format)
    digits_only := '0' || substring(digits_only from 3);
    IF length(digits_only) = 11 THEN
      RETURN digits_only;
    END IF;
  ELSIF length(digits_only) = 10 THEN
    -- Add leading 0 to 10-digit numbers (assuming UK)
    RETURN '0' || digits_only;
  ELSIF length(digits_only) = 11 AND digits_only ~ '^0' THEN
    -- Already correct UK format
    RETURN digits_only;
  END IF;

  -- Return as-is if it doesn't match common patterns, but only if >= 10 digits
  IF length(digits_only) >= 10 THEN
    RETURN digits_only;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update clients table phone numbers
UPDATE clients 
SET phone = normalize_phone_number(phone)
WHERE phone IS NOT NULL 
  AND phone != normalize_phone_number(phone);

-- Drop the temporary function
DROP FUNCTION normalize_phone_number(text);