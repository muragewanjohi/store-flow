/**
 * Helper script to inspect the Enterprise menu item structure
 * Instructions: Run this to see what selectors to use
 */

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  How to Find the Correct CSS Selector                        ║
╚══════════════════════════════════════════════════════════════╝

1. Open your dashboard in the browser
2. Open DevTools (F12 or Right-click → Inspect)
3. Click the user menu (the profile icon/name in top-right)
4. Right-click on "Explore Enterprise Edition" → Inspect Element
5. Look at the HTML structure. You'll see something like:

   <button class="some-class" aria-label="...">
     <span>Explore Enterprise Edition</span>
   </button>

   OR

   <a href="..." class="some-class">
     Explore Enterprise Edition
   </a>

6. Note:
   - The exact class name(s)
   - Any data attributes (data-testid, data-*, etc.)
   - The aria-label value
   - The href if it's a link

7. Update src/dashboard/custom-styles.css with the specific selector

Example selectors you might find:
- .vendure-enterprise-link
- button[data-testid="enterprise-menu"]
- [aria-label="Explore Enterprise Edition"]
- a[href*="vendure.io/enterprise"]

Once you find the selector, add it to custom-styles.css and rebuild:
  npm run build:dashboard

`);


