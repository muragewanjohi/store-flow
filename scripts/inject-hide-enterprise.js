/**
 * Enhanced script that injects both CSS and JavaScript to hide Enterprise menu
 * JavaScript is more reliable for hiding elements by text content
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../dist/dashboard/index.html');
const cssPath = path.join(__dirname, '../src/dashboard/custom-styles.css');

if (!fs.existsSync(indexPath)) {
  console.error('❌ Dashboard index.html not found at:', indexPath);
  console.error('   Run "npm run build:dashboard" first');
  process.exit(1);
}

try {
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Check if already injected
  if (html.includes('hide-enterprise-menu')) {
    console.log('ℹ️  Hide Enterprise script already injected, skipping...');
    process.exit(0);
  }
  
  // Inject CSS if CSS file exists
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    const styleTag = `\n  <style id="hide-enterprise-menu-css">\n    /* Custom Dashboard Styles - Hide Enterprise Edition Menu */\n    ${css}\n  </style>\n`;
    html = html.replace('</head>', `${styleTag}</head>`);
  }
  
  // Inject JavaScript to hide by text content (more reliable)
  const scriptTag = `
  <script id="hide-enterprise-menu">
    (function() {
      function hideEnterpriseMenu() {
        // Find all elements that might contain "Explore Enterprise Edition"
        const allElements = document.querySelectorAll('button, a, [role="menuitem"], [role="button"]');
        allElements.forEach(el => {
          const text = el.textContent || el.innerText || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const href = el.getAttribute('href') || '';
          
          if (text.includes('Explore Enterprise Edition') || 
              text.includes('Enterprise Edition') ||
              ariaLabel.includes('Enterprise') ||
              href.includes('enterprise')) {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.remove(); // Remove from DOM entirely
          }
        });
      }
      
      // Run immediately
      hideEnterpriseMenu();
      
      // Run after DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideEnterpriseMenu);
      } else {
        hideEnterpriseMenu();
      }
      
      // Run after a short delay (for dynamic content)
      setTimeout(hideEnterpriseMenu, 100);
      setTimeout(hideEnterpriseMenu, 500);
      
      // Watch for dynamic menu opens
      const observer = new MutationObserver(hideEnterpriseMenu);
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    })();
  </script>`;
  
  html = html.replace('</body>', `${scriptTag}\n</body>`);
  
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('✅ Enhanced hide Enterprise script injected');
  console.log('   - CSS rules applied');
  console.log('   - JavaScript fallback active');
  console.log('   - Dynamic menu monitoring enabled');
} catch (error) {
  console.error('❌ Error injecting script:', error.message);
  process.exit(1);
}


