# ProSpaces Brand Guidelines

## Overview
This document outlines the brand guidelines for ProSpaces and how to implement them consistently across all pages and components.

## Brand Components

### 1. Import Brand Components
```tsx
import { 
  BrandCard, 
  BrandBadge, 
  BrandButton, 
  BrandHeading1, 
  BrandHeading2, 
  BrandHeading3, 
  BrandBody,
  BrandPage,
  BrandContainer,
  BrandLoading,
  DASHBOARD_TILES,
  getStatusColor
} from '@/components/brand';
```

### 2. Page Layout
Always use brand layout components:

```tsx
// For full pages
<BrandPage>
  <BrandContainer>
    <BrandHeading1>Page Title</BrandHeading1>
    <BrandBody>Page content...</BrandBody>
  </BrandContainer>
</BrandPage>

// For loading states
<BrandLoading />
```

### 3. Typography
Use brand typography components:

```tsx
<BrandHeading1>Main Titles (Montserrat Medium)</BrandHeading1>
<BrandHeading2>Subtitles (Montserrat Light)</BrandHeading2>
<BrandHeading3>Section Headers (Montserrat Semi-Bold)</BrandHeading3>
<BrandBody>Body Text (Montserrat Regular)</BrandBody>
```

### 4. Cards
Use BrandCard for dashboard tiles and content cards:

```tsx
<BrandCard
  title="Quotes"
  description="View & accept quotes"
  icon={<FileText className="h-8 w-8" />}
  iconBg={DASHBOARD_TILES.quotes.iconBg}
  iconColor={DASHBOARD_TILES.quotes.iconColor}
  badge={<BrandBadge variant="teal">5 Active</BrandBadge>}
  interactive
  onClick={() => navigate('/quotes')}
/>
```

### 5. Status Badges
Use BrandBadge for status indicators:

```tsx
<BrandBadge status="sent">Pending</BrandBadge>
<BrandBadge status="accepted">Accepted</BrandBadge>
<BrandBadge variant="teal">Custom Badge</BrandBadge>
```

### 6. Buttons
Use BrandButton for brand-consistent buttons:

```tsx
<BrandButton brandVariant="primary">Primary Action</BrandButton>
<BrandButton brandVariant="secondary">Secondary Action</BrandButton>
<BrandButton brandVariant="accent">Accent Action</BrandButton>
```

## Brand Colors

### Primary Palette
- **Teal**: `#8ac4c2` - Primary brand color
- **Pink**: `#f7ccd6` - Secondary accent
- **Green**: `#d1d9b0` - Success/positive actions
- **Cream**: `#f5efe8` - Background/neutral
- **Primary**: `#2b2e3d` - Text/dark elements

### Usage Guidelines
- **Teal**: Use for primary actions, quotes, main branding
- **Pink**: Use for messages, notifications, secondary highlights
- **Green**: Use for projects, success states, positive feedback
- **Cream**: Use for backgrounds, neutral areas
- **Primary**: Use for text, headers, important content

## Dashboard Tiles
Use the predefined tile configurations:

```tsx
import { DASHBOARD_TILES } from '@/components/brand';

// Quotes tile
<BrandCard
  {...DASHBOARD_TILES.quotes}
  title="Quotes"
  // ... other props
/>
```

Available tile types:
- `quotes` - Teal themed
- `projects` - Green themed  
- `messages` - Pink themed
- `payments` - Cream themed
- `documents` - Accent themed

## CSS Classes

### Pre-built Classes
```css
/* Status Colors */
.status-sent, .status-accepted, .status-declined, .status-pending

/* Icon Backgrounds */
.icon-bg-teal, .icon-bg-pink, .icon-bg-green, .icon-bg-cream

/* Button Variants */
.btn-brand-primary, .btn-brand-secondary, .btn-brand-accent

/* Badge Variants */
.badge-teal, .badge-green, .badge-pink, .badge-cream

/* Layout */
.brand-page, .brand-container, .brand-card, .brand-card-interactive

/* Typography */
.brand-heading-1, .brand-heading-2, .brand-heading-3, .brand-body, .brand-title
```

## Migration Guide

### For Existing Pages
1. Replace layout divs with `<BrandPage>` and `<BrandContainer>`
2. Replace headings with `<BrandHeading1>`, `<BrandHeading2>`, etc.
3. Replace status badges with `<BrandBadge status="...">`
4. Replace cards with `<BrandCard>` using tile configurations
5. Replace buttons with `<BrandButton brandVariant="...">`

### For New Pages
1. Always start with brand layout components
2. Use brand typography components for all text
3. Use brand color utilities and components
4. Reference `DASHBOARD_TILES` for consistent theming

## Examples

### Complete Dashboard Tile
```tsx
<BrandCard
  title="Quotes"
  description="View & accept quotes"
  icon={<FileText className="h-8 w-8" />}
  iconBg={DASHBOARD_TILES.quotes.iconBg}
  iconColor={DASHBOARD_TILES.quotes.iconColor}
  badge={
    <div className={`inline-flex items-center justify-center ${DASHBOARD_TILES.quotes.badgeBg} ${DASHBOARD_TILES.quotes.badgeText} text-sm font-medium px-3 py-1 rounded-full brand-body`}>
      {quotes.length} Active
    </div>
  }
  interactive
  onClick={() => setViewMode('quotes')}
/>
```

### Status Badge with Icon
```tsx
<BrandBadge status={quote.status} className="inline-flex items-center gap-1">
  <CheckCircle className="h-3 w-3" />
  {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
</BrandBadge>
```

This ensures all current and future pages maintain consistent ProSpaces branding.
