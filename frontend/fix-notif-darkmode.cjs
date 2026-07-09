const fs = require('fs');
let code = fs.readFileSync('src/components/shared/NotificationsDrawer.jsx', 'utf8');

// 1. Drawer inline style background & border
code = code.replace(/background: 'rgba\(248, 250, 252, 0\.98\)',/g, 
  "background: theme === 'light' ? 'rgba(248, 250, 252, 0.98)' : 'rgba(8, 11, 16, 0.98)',");
code = code.replace(/borderLeft: '1px solid #E2E8F0',/g, 
  "borderLeft: theme === 'light' ? '1px solid #E2E8F0' : '1px solid #1E293B',");

// 2. Inline borderColors
code = code.replace(/style=\{\{ borderColor: '#E2E8F0' \}\}/g, 
  "style={{ borderColor: theme === 'light' ? '#E2E8F0' : '#1E293B' }}");
code = code.replace(/borderColor: '#E2E8F0'/g, 
  "borderColor: theme === 'light' ? '#E2E8F0' : '#1E293B'");

// 3. Tailwind Borders
code = code.replace(/border-\[#E2E8F0\]/g, 'border-[#E2E8F0] dark:border-[#1E293B]');

// 4. Texts
code = code.replace(/text-\[#0F172A\]/g, 'text-[#0F172A] dark:text-white');
code = code.replace(/text-\[#334155\]/g, 'text-[#334155] dark:text-slate-200');
code = code.replace(/text-\[#475569\]/g, 'text-[#475569] dark:text-slate-300');
code = code.replace(/text-\[#64748B\]/g, 'text-[#64748B] dark:text-slate-400');
code = code.replace(/hover:text-\[#0F172A\]/g, 'hover:text-[#0F172A] dark:hover:text-white');

// 5. Backgrounds
code = code.replace(/bg-\[#F1F5F9\]/g, 'bg-[#F1F5F9] dark:bg-[#0F172A]');
code = code.replace(/bg-blue-50\/50/g, 'bg-blue-50/50 dark:bg-blue-900/10');
code = code.replace(/bg-white /g, 'bg-white dark:bg-transparent ');
code = code.replace(/hover:bg-slate-50/g, 'hover:bg-slate-50 dark:hover:bg-slate-800/50');
code = code.replace(/border-[#FFFFFF]/g, 'border-[#FFFFFF] dark:border-[#0F172A]');

// 6. Icons function "isLight"
// Change `const isLight = true;` to `const isLight = theme === 'light';`
code = code.replace(/const isLight = true;/g, "const isLight = theme === 'light';");

fs.writeFileSync('src/components/shared/NotificationsDrawer.jsx', code);
