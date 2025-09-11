/**
 * Utility functions for working with postcodes and extracting them from addresses
 */

// UK postcode regex pattern
const UK_POSTCODE_REGEX = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/gi;

/**
 * Extracts the best postcode from various address-related fields
 */
export function getBestPostcode(
  address?: string | null,
  postcode?: string | null,
  full_address?: string | null
): string | null {
  // Priority order: explicit postcode field, then extract from full_address, then from address
  const sources = [postcode, full_address, address].filter(Boolean);
  
  for (const source of sources) {
    if (source) {
      const extracted = extractPostcodeFromString(source);
      if (extracted) {
        return extracted;
      }
    }
  }
  
  return null;
}

/**
 * Extracts postcode from a string using regex
 */
export function extractPostcodeFromString(text: string): string | null {
  const matches = text.match(UK_POSTCODE_REGEX);
  if (matches && matches.length > 0) {
    // Return the first match, cleaned up
    return matches[0].toUpperCase().replace(/\s+/g, ' ').trim();
  }
  return null;
}

/**
 * Normalizes a postcode to standard format (uppercase, single space)
 */
export function normalizePostcode(postcode: string): string {
  return postcode
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates if a string looks like a UK postcode
 */
export function isValidUKPostcode(postcode: string): boolean {
  return UK_POSTCODE_REGEX.test(postcode);
}

/**
 * Extracts postcode area (first part) from a full postcode
 * Example: "SW1A 1AA" -> "SW1A"
 */
export function getPostcodeArea(postcode: string): string | null {
  const normalized = normalizePostcode(postcode);
  const parts = normalized.split(' ');
  return parts.length === 2 ? parts[0] : null;
}