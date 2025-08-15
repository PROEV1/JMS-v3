/**
 * ProSpaces Brand Guidelines Utilities
 * 
 * This file contains utility functions and constants to ensure
 * consistent application of brand guidelines across all components.
 */

// Brand Colors Map
export const BRAND_COLORS = {
  primary: 'hsl(var(--primary))',
  teal: 'hsl(var(--brand-teal))',
  pink: 'hsl(var(--brand-pink))',
  green: 'hsl(var(--brand-green))',
  cream: 'hsl(var(--brand-cream))',
} as const;

// Status Colors (following brand guidelines)
export const STATUS_COLORS = {
  sent: 'status-sent',
  pending: 'status-pending', 
  accepted: 'status-accepted',
  declined: 'status-declined',
  expired: 'bg-muted text-muted-foreground',
  complete: 'status-accepted',
  active: 'status-sent',
} as const;

// Icon Background Classes
export const ICON_BACKGROUNDS = {
  teal: 'icon-bg-teal',
  pink: 'icon-bg-pink', 
  green: 'icon-bg-green',
  cream: 'icon-bg-cream',
} as const;

// Typography Classes
export const TYPOGRAPHY = {
  heading1: 'brand-heading-1',
  heading2: 'brand-heading-2',
  heading3: 'brand-heading-3',
  body: 'brand-body',
  title: 'brand-title',
} as const;

// Button Variants
export const BUTTON_VARIANTS = {
  primary: 'btn-brand-primary',
  secondary: 'btn-brand-secondary', 
  accent: 'btn-brand-accent',
} as const;

// Badge Variants
export const BADGE_VARIANTS = {
  teal: 'badge-teal',
  green: 'badge-green',
  pink: 'badge-pink',
  cream: 'badge-cream',
} as const;

/**
 * Get status color class based on status
 */
export const getStatusColor = (status: string): string => {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-muted text-muted-foreground';
};

/**
 * Get icon background class for specific brand color
 */
export const getIconBackground = (color: keyof typeof ICON_BACKGROUNDS): string => {
  return ICON_BACKGROUNDS[color];
};

/**
 * Get typography class for specific text type
 */
export const getTypographyClass = (type: keyof typeof TYPOGRAPHY): string => {
  return TYPOGRAPHY[type];
};

/**
 * Get button variant class
 */
export const getButtonVariant = (variant: keyof typeof BUTTON_VARIANTS): string => {
  return BUTTON_VARIANTS[variant];
};

/**
 * Get badge variant class
 */
export const getBadgeVariant = (variant: keyof typeof BADGE_VARIANTS): string => {
  return BADGE_VARIANTS[variant];
};

/**
 * Brand-compliant tile configuration for dashboard cards
 */
export const DASHBOARD_TILES = {
  quotes: {
    iconBg: getIconBackground('teal'),
    iconColor: 'text-brand-teal',
    badgeBg: 'bg-brand-teal-light/20',
    badgeText: 'text-brand-teal',
  },
  projects: {
    iconBg: getIconBackground('green'),
    iconColor: 'text-brand-green', 
    badgeBg: 'bg-brand-green-light/20',
    badgeText: 'text-brand-green',
  },
  messages: {
    iconBg: getIconBackground('pink'),
    iconColor: 'text-brand-pink',
    badgeBg: 'bg-brand-pink-light/20', 
    badgeText: 'text-brand-pink',
  },
  payments: {
    iconBg: getIconBackground('cream'),
    iconColor: 'text-primary',
    badgeBg: 'bg-brand-cream/50',
    badgeText: 'text-primary',
  },
  documents: {
    iconBg: 'bg-accent/20',
    iconColor: 'text-accent-foreground',
    badgeBg: 'bg-accent/20',
    badgeText: 'text-accent-foreground',
  },
} as const;

/**
 * Common page layouts following brand guidelines
 */
export const PAGE_LAYOUTS = {
  fullPage: 'brand-page',
  container: 'brand-container',
  loadingSpinner: 'brand-spinner',
  card: 'brand-card',
  interactiveCard: 'brand-card-interactive',
} as const;