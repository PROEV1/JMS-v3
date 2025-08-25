# Design Version System - Playbook

## Overview
The Pro EV app now features a dual-design system with instant rollback capability. This allows safe testing and deployment of design improvements while maintaining the ability to instantly revert to the current production design.

## Quick Reference

### Instant Rollback Options
1. **Admin Panel**: Go to Admin Settings → Design tab → Select "Legacy"
2. **URL Override**: Add `?design=legacy` to any URL
3. **Environment Variable**: Set `VITE_DESIGN_VERSION=legacy` in .env file

### Design Versions
- **Legacy**: Current production design (default)
- **v2**: Enhanced brand-consistent design with gradients, improved spacing, and modern effects

## How It Works

### Architecture
```
🏗️ DesignVersionProvider (React Context)
    ├── 📊 Data Sources (order of precedence):
    │   ├── URL param (?design=v2|legacy)
    │   ├── localStorage (persistent setting)
    │   └── Environment variable (VITE_DESIGN_VERSION)
    │
    ├── 🎯 DOM Integration:
    │   └── Sets data-design attribute on <html> element
    │
    └── 🔄 Auto-sync: URL ↔ localStorage ↔ UI state
```

### CSS Targeting System
```css
/* Legacy styles (default) - no prefix needed */
.btn-brand-primary { /* current styles */ }

/* v2 styles - only active when data-design="v2" */
[data-design="v2"] .btn-brand-primary {
  background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-teal)));
  box-shadow: 0 4px 15px hsl(var(--primary) / 0.3);
}
```

## Usage Guide

### For Developers

#### Using Brand Components
```tsx
import { BrandButton, BrandBadge, BrandTypography } from '@/components/brand';

// Components automatically adapt based on design version
<BrandButton brandVariant="primary">Click me</BrandButton>
<BrandBadge variant="teal">Status</BrandBadge>
<BrandTypography variant="heading1">Welcome</BrandTypography>
```

#### Checking Design Version in Code
```tsx
import { useDesignVersion } from '@/contexts/DesignVersionContext';

function MyComponent() {
  const { currentVersion, isV2, setVersion } = useDesignVersion();
  
  // Conditional logic based on design version
  if (isV2) {
    // v2-specific behavior
  }
}
```

#### Adding New v2 Styles
```css
/* Add to src/index.css */
[data-design="v2"] .my-new-component {
  /* v2 styles here */
}
```

### For Administrators

#### Admin Panel Control
1. Navigate to **Admin Settings**
2. Click the **Design** tab
3. Select desired version from dropdown
4. Changes apply instantly

#### URL Testing
- Test v2: `https://your-app.com/any-page?design=v2`
- Test legacy: `https://your-app.com/any-page?design=legacy`
- Share with stakeholders for review

#### Environment Configuration
```env
# .env file
VITE_DESIGN_VERSION=legacy  # or "v2"
```

### For QA/Testing

#### Test Scenarios
1. **Version Switching**: Toggle between versions in Admin Settings
2. **URL Override**: Test `?design=v2` parameter on different pages
3. **Persistence**: Verify settings persist across browser sessions
4. **Fallback**: Ensure legacy version works when v2 fails
5. **Development Banner**: Check banner appears in non-production

#### Browser Testing
- Clear localStorage and test default behavior
- Test with different URL parameters
- Verify mobile responsive design in both versions

## Development Banner

In development, a floating banner shows current design version with quick toggle:

```
┌─────────────────────────────┐
│ 🎨 Design: v2  [Legacy ↻]  │  
└─────────────────────────────┘
```

## Rollback Procedures

### Emergency Rollback (Production)
1. **Immediate**: Set environment variable `VITE_DESIGN_VERSION=legacy`
2. **Admin Panel**: Admin Settings → Design → Select "Legacy"
3. **URL Override**: Add `?design=legacy` to problematic URLs

### Planned Rollback
1. Communicate to team via chosen channels
2. Update environment variable in deployment
3. Clear any cached settings if needed
4. Verify rollback success across key pages

## File Structure

```
src/
├── contexts/
│   └── DesignVersionContext.tsx    # Main provider
├── components/
│   ├── brand/                      # Version-aware brand components
│   │   ├── BrandButton.tsx
│   │   ├── BrandBadge.tsx
│   │   └── BrandTypography.tsx
│   ├── admin/
│   │   └── DesignVersionToggle.tsx # Admin control panel
│   └── dev/
│       └── DesignVersionBanner.tsx # Development banner
├── index.css                       # CSS with v2 overrides
└── main.tsx                        # Provider setup
```

## Troubleshooting

### Common Issues

**Q: Changes not applying**
- Clear browser cache and localStorage
- Check data-design attribute on <html> element
- Verify CSS specificity in dev tools

**Q: Settings not persisting**
- Check localStorage in browser dev tools
- Verify DesignVersionProvider is wrapping app correctly

**Q: URL override not working**
- Ensure URL format: `?design=v2` (not `&design=v2` as first param)
- Check browser console for JavaScript errors

### Debug Information
```tsx
// Add to any component for debugging
const { currentVersion } = useDesignVersion();
console.log('Current design version:', currentVersion);
console.log('HTML data-design:', document.documentElement.getAttribute('data-design'));
```

## Best Practices

### Adding New Features
1. **Default to Legacy**: New components should work without v2 styles
2. **Progressive Enhancement**: Add v2 styles as enhancements, not replacements
3. **Test Both Versions**: Always verify both legacy and v2 render correctly
4. **Document Changes**: Update this playbook when adding new v2 features

### CSS Guidelines
```css
/* ✅ Good: Scoped v2 enhancement */
[data-design="v2"] .component {
  background: linear-gradient(...);
}

/* ❌ Bad: Overriding without scoping */
.component {
  background: linear-gradient(...);
}
```

### Component Guidelines
```tsx
// ✅ Good: Version-aware logic
const { isV2 } = useDesignVersion();
const className = isV2 ? 'enhanced-style' : 'base-style';

// ❌ Bad: Hardcoded assumptions
const className = 'enhanced-style'; // Won't work in legacy
```

## Deployment Strategy

### Phase 1: Internal Testing
- Deploy with `VITE_DESIGN_VERSION=legacy` (safe default)
- Enable v2 via Admin Settings for internal testing
- Gather feedback and iterate

### Phase 2: Stakeholder Review  
- Share URLs with `?design=v2` parameter
- Collect approval from stakeholders
- Address any feedback

### Phase 3: Gradual Rollout
- Switch default to `VITE_DESIGN_VERSION=v2`
- Monitor for issues
- Keep legacy available for quick rollback

### Phase 4: Full Deployment
- Remove legacy support (future phase)
- Clean up CSS and component code
- Archive this playbook

---

**Remember**: The legacy version is your safety net. When in doubt, rollback first, investigate second.