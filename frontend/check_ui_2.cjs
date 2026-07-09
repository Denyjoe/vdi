const fs = require('fs');
let navbar = fs.readFileSync('src/components/layout/Navbar.jsx', 'utf8');
let start = navbar.indexOf('QUICK START GUIDE MODAL');
let end = navbar.indexOf('</button>', navbar.indexOf('Close', start)) + 30;
if(start !== -1) console.log(navbar.substring(start, end));

let settings = fs.readFileSync('src/components/shared/SettingsPanel.jsx', 'utf8');
let tokenStart = settings.indexOf('className="bg-black/50 border border-slate-700 rounded-xl p-4 mb-6 relative overflow-hidden"');
if (tokenStart !== -1) {
  let tokenSnippet = settings.substring(tokenStart - 200, tokenStart + 500);
  console.log('\n--- TOKEN SNIPPET ---');
  console.log(tokenSnippet);
} else {
  // Try to find the newKey area
  let newKeyIdx = settings.indexOf('{newKey}');
  if (newKeyIdx !== -1) {
    console.log('\n--- TOKEN SNIPPET (fallback) ---');
    console.log(settings.substring(newKeyIdx - 200, newKeyIdx + 300));
  }
}
