# Hide "Explore Enterprise Edition" Menu Item

## Quick Solution

The simplest way is to use a post-build script that injects CSS into the built dashboard.

## Setup

1. **Build the dashboard with CSS injection:**
   ```bash
   npm run build:dashboard
   ```

2. **Restart your Vendure server:**
   ```bash
   npm run dev
   ```

## How It Works

1. The `vite build` command builds the dashboard to `dist/dashboard/`
2. The `scripts/inject-dashboard-css.js` script automatically injects CSS from `src/dashboard/custom-styles.css` into `dist/dashboard/index.html`
3. The CSS hides the "Explore Enterprise Edition" menu item

## Manual Inspection (If CSS doesn't work)

If the CSS selectors don't match the actual DOM structure:

1. Open the dashboard in your browser
2. Right-click on "Explore Enterprise Edition" → Inspect Element
3. Note the exact HTML structure, classes, and attributes
4. Update `src/dashboard/custom-styles.css` with more specific selectors
5. Rebuild: `npm run build:dashboard`

## Alternative: Browser Extension (Quick Test)

For immediate testing without rebuilding:

1. Install a CSS injection extension (e.g., Stylus, User CSS)
2. Add this CSS rule:
   ```css
   /* Find the exact selector using DevTools, then add it here */
   button[aria-label*="Enterprise"] {
     display: none !important;
   }
   ```

## Files Created

- `src/dashboard/custom-styles.css` - CSS rules to hide the menu item
- `scripts/inject-dashboard-css.js` - Post-build script to inject CSS
- `package.json` - Added `build:dashboard` script

## Notes

- The CSS is injected after each build, so it persists across rebuilds
- If Vendure updates their dashboard structure, you may need to update the CSS selectors
- The selectors use valid CSS (case-insensitive attribute matching with `i` flag where supported)
