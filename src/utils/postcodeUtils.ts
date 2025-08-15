/**
 * Utility functions for working with postcodes
 */

/**
 * Normalizes postcode by converting "O" to "0" and formatting correctly
 */
export function normalizePostcode(postcode: string): string {
  if (!postcode) return '';
  
  return postcode
    .replace(/O/g, '0') // Replace O with 0
    .replace(/\s+/g, ' ') // Normalize spaces
    .toUpperCase()
    .trim();
}

/**
 * Extracts postcode from an address string
 */
export function extractPostcodeFromAddress(address: string): string | null {
  if (!address) return null;
  
  // UK postcode regex pattern
  const postcodePattern = /([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i;
  const match = address.match(postcodePattern);
  
  if (match) {
    return normalizePostcode(match[1]);
  }
  
  return null;
}

/**
 * Gets the best available postcode from multiple sources
 * Priority: order.postcode → client.address → order.job_address
 */
export function getBestPostcode(order: {
  postcode?: string;
  job_address?: string;
  client?: {
    address?: string;
  };
}): string | null {
  // 1. Try order.postcode first
  if (order.postcode) {
    return normalizePostcode(order.postcode);
  }
  
  // 2. Try extracting from client.address
  if (order.client?.address) {
    const extracted = extractPostcodeFromAddress(order.client.address);
    if (extracted) {
      return extracted;
    }
  }
  
  // 3. Try extracting from order.job_address
  if (order.job_address) {
    const extracted = extractPostcodeFromAddress(order.job_address);
    if (extracted) {
      return extracted;
    }
  }
  
  return null;
}

/**
 * Gets display text for postcode/location with fallback to address
 */
export function getLocationDisplayText(order: {
  postcode?: string;
  job_address?: string;
  client?: {
    address?: string;
  };
}): string {
  const postcode = getBestPostcode(order);
  
  if (postcode) {
    return postcode;
  }
  
  // Fallback to showing last part of address if no postcode
  const address = order.job_address || order.client?.address;
  if (address) {
    const parts = address.split(',');
    return parts[parts.length - 1]?.trim() || address;
  }
  
  return 'No location';
}