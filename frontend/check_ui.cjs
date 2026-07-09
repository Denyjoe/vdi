const fs = require('fs');

let sidebar = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');
let match = sidebar.match(/function NavItem[\s\S]+?return \([\s\S]+?<\/Link>\s*\);/);
if (match) {
  console.log('--- NavItem in Sidebar.jsx ---');
  console.log(match[0]);
}

let join = fs.readFileSync('src/components/shared/JoinByCodeModal.jsx', 'utf8');
let inputMatch = join.match(/<input[^>]+className="[^"]*text-white[^"]*"[^>]*>/);
if (inputMatch) {
  console.log('\n--- JoinByCodeModal text-white input ---');
  console.log(inputMatch[0]);
}

let dash = fs.readFileSync('src/pages/DashboardPage.jsx', 'utf8');
let quickStartMatch = dash.match(/<div[^>]*>STEP 1<\/div>/i);
if (quickStartMatch) {
  console.log('\n--- Quick Start Box in DashboardPage ---');
  console.log(quickStartMatch[0]);
}
