/**
 * Currency formatting utilities for UK Pounds (£)
 */

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '£0.00';
  }

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatCurrencyCompact = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '£0';
  }

  // For values under £1000, show full amount
  if (Math.abs(amount) < 1000) {
    return formatCurrency(amount);
  }

  // For larger values, use compact notation
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(amount);
};

export const parseCurrency = (value: string): number => {
  // Remove currency symbols and parse
  const cleanValue = value.replace(/[£,\s]/g, '');
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
};

export const calculateLineTotal = (quantity: number, unitCost: number): number => {
  return Math.round((quantity * unitCost) * 100) / 100; // Round to 2 decimal places
};