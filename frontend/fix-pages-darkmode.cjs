const fs = require('fs');
const files = [
  'src/pages/public/TermsPage.jsx',
  'src/pages/public/PrivacyPage.jsx'
];

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');

  // Backgrounds
  code = code.replace(/bg-\[#F8FAFC\]\/80/g, 'bg-[#F8FAFC]/80 dark:bg-[#050B18]/80');
  code = code.replace(/bg-\[#F8FAFC\](?![\w/])/g, 'bg-[#F8FAFC] dark:bg-[#050B18]');

  // Borders
  code = code.replace(/border-\[#E2E8F0\]/g, 'border-[#E2E8F0] dark:border-slate-800');

  // Text
  code = code.replace(/text-\[#0F172A\]/g, 'text-[#0F172A] dark:text-white');
  code = code.replace(/text-\[#1E293B\]/g, 'text-[#1E293B] dark:text-slate-100');
  code = code.replace(/text-\[#334155\]/g, 'text-[#334155] dark:text-slate-200');
  code = code.replace(/text-\[#475569\]/g, 'text-[#475569] dark:text-slate-300');
  code = code.replace(/text-\[#64748B\]/g, 'text-[#64748B] dark:text-slate-400');
  
  // Hover text overrides
  code = code.replace(/hover:text-\[#0F172A\]/g, 'hover:text-[#0F172A] dark:hover:text-white');

  fs.writeFileSync(file, code);
});
