const fs = require('fs');
let text = fs.readFileSync('src/components/shared/NotificationsDrawer.jsx', 'utf8');

// 1. Date Header Background & Text
// Current line is: <div className="px-5 py-2 sticky top-0 bg-[#F1F5F9] dark:bg-[#111827] backdrop-blur-sm z-10">
text = text.replace(/bg-\[#F1F5F9\] dark:bg-\[#111827\]/g, 'bg-slate-100 dark:bg-slate-900/90');

// The paragraph style has this messed up string: style={{ color: theme === 'light' ? '#64748B' : 'var(--text-[#64748B] dark:text-faint)', fontWeight: 600, letterSpacing: '2px' }} className="text-[9px] uppercase"
text = text.replace(/<p style=\{\{ color: theme === 'light' \? '#64748B' : 'var\(--text-\[#64748B\] dark:text-faint\)', fontWeight: 600, letterSpacing: '2px' \}\} className="text-\[9px\] uppercase">/g, 
  `<p style={{ fontWeight: 600, letterSpacing: '2px' }} className="text-[9px] uppercase text-slate-500 dark:text-slate-400">`);


// 2. Notification Items borders and hover
// Currently:
// style={{
//   borderBottom: theme === 'light' ? '1px solid #E2E8F0' : '1px solid var(--border-subtle)',
//   background: !notif.is_read 
//     ? (theme === 'light' ? 'rgba(37, 99, 235, 0.04)' : 'rgba(0, 102, 255, 0.03)') 
//     : (theme === 'light' ? '#FFFFFF' : 'transparent')
// }}
// className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-all duration-200 group ${
//   !notif.is_read
//     ? 'hover:bg-[var(--bg-nav-hover)]'
//     : 'hover:bg-[var(--bg-nav-hover)]'
// }`}

const styleRegex = /style=\{\{\s*borderBottom: theme === 'light' \? '1px solid #E2E8F0' : '1px solid var\(--border-subtle\)',\s*background: !notif\.is_read[\s\S]*?\s*\}\}/;
const classNameRegex = /className=\{\`flex items-start gap-3 px-5 py-4 cursor-pointer transition-all duration-200 group \$\{\s*!notif\.is_read\s*\?\s*'hover:bg-\[var\(--bg-nav-hover\)\]'\s*:\s*'hover:bg-\[var\(--bg-nav-hover\)\]'\s*\}\`\}/;

text = text.replace(styleRegex, '');
text = text.replace(classNameRegex, 
  "className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-all duration-200 group border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!notif.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-transparent dark:bg-transparent'}`}"
);

fs.writeFileSync('src/components/shared/NotificationsDrawer.jsx', text);
