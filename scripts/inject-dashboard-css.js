/**
 * Post-build script to inject custom CSS into the built dashboard
 * This hides the "Explore Enterprise Edition" menu item
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

if (!fs.existsSync(cssPath)) {
  console.error('❌ Custom CSS file not found at:', cssPath);
  process.exit(1);
}

try {
  const html = fs.readFileSync(indexPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  
  // Check if CSS is already injected
  if (html.includes('Hide "Explore Enterprise Edition"')) {
    console.log('ℹ️  Custom CSS already injected, skipping...');
    process.exit(0);
  }
  
  // Inject CSS before </head>
  const styleTag = `\n  <style>\n    /* Custom Dashboard Styles - Hide Enterprise Edition Menu */\n    ${css}\n  </style>\n`;
  const updatedHtml = html.replace('</head>', `${styleTag}</head>`);
  
  fs.writeFileSync(indexPath, updatedHtml, 'utf8');
  console.log('✅ Custom CSS injected into dashboard');
  console.log('   Hidden: "Explore Enterprise Edition" menu item');
} catch (error) {
  console.error('❌ Error injecting CSS:', error.message);
  process.exit(1);
}


