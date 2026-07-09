const fs = require('fs');
let code = fs.readFileSync('src/pages/public/LandingPage.jsx', 'utf8');

// Container Backgrounds
code = code.replace(/bg-\[#F8FAFC\]/g, 'bg-[#F8FAFC] dark:bg-[#050B18]');
code = code.replace(/bg-\[#FFFFFF\]/g, 'bg-white dark:bg-[#0A1124]');

// Headings and strong text
code = code.replace(/text-\[#0F172A\]/g, 'text-[#0F172A] dark:text-white');
code = code.replace(/text-\[#334155\]/g, 'text-[#334155] dark:text-slate-200');
code = code.replace(/text-\[#475569\]/g, 'text-[#475569] dark:text-slate-300');

// Borders
code = code.replace(/border-\[#E2E8F0\]/g, 'border-[#E2E8F0] dark:border-slate-800');

// Join with Code button background
code = code.replace(/bg-\[var\(--bg-card\)\]/g, 'bg-white dark:bg-slate-800');
code = code.replace(/hover:bg-\[var\(--bg-card-hover\)\]/g, 'hover:bg-slate-50 dark:hover:bg-slate-700');

// Features Cards
code = code.replace(/bg-\[var\(--bg-primary\)\]/g, 'bg-white dark:bg-[#0A1124]');

// Active Navigation link
code = code.replace(/hover:text-\[#0F172A\]/g, 'hover:text-[#0F172A] dark:hover:text-white');

fs.writeFileSync('src/pages/public/LandingPage.jsx', code);
