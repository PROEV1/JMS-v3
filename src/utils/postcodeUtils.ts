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
 * Priority: order.postcode → client.postcode → client.address → order.job_address
 */
export function getBestPostcode(order: {
  postcode?: string;
  job_address?: string;
  client?: {
    address?: string;
    postcode?: string;
  };
}): string | null {
  // 1. Try order.postcode first
  if (order.postcode) {
    return normalizePostcode(order.postcode);
  }
  
  // 2. Try client.postcode directly
  if (order.client?.postcode) {
    return normalizePostcode(order.client.postcode);
  }
  
  // 3. Try extracting from client.address
  if (order.client?.address) {
    const extracted = extractPostcodeFromAddress(order.client.address);
    if (extracted) {
      return extracted;
    }
  }
  
  // 4. Try extracting from order.job_address
  if (order.job_address) {
    const extracted = extractPostcodeFromAddress(order.job_address);
    if (extracted) {
      return extracted;
    }
  }
  
  return null;
}

/**
 * Extracts the outward code from a UK postcode (the part before the space)
 * Examples: "DA5 1BJ" -> "DA5", "SW1A 1AA" -> "SW1A", "M1 1AA" -> "M1"
 */
export function getOutwardCode(postcode: string): string {
  if (!postcode) return '';
  
  const normalized = normalizePostcode(postcode);
  
  // Split by space and take the first part (outward code)
  const parts = normalized.split(' ');
  return parts[0] || '';
}

/**
 * Gets display text for postcode/location with fallback to address
 */
export function getLocationDisplayText(order: {
  postcode?: string;
  job_address?: string;
  client?: {
    address?: string;
    postcode?: string;
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