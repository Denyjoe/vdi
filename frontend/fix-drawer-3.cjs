const fs = require('fs');
let code = fs.readFileSync('src/components/shared/NotificationsDrawer.jsx', 'utf8');

// Container base
code = code.replace(/background: theme === 'light' \? 'rgba\(248, 250, 252, 0\.96\)' : 'rgba\(10, 14, 20, 0\.92\)'/g, "background: 'rgba(248, 250, 252, 0.98)'");
code = code.replace(/borderLeft: theme === 'light' \? '1px solid #E2E8F0' : '1px solid rgba\(255,255,255,0\.06\)'/g, "borderLeft: '1px solid #E2E8F0'");
code = code.replace(/borderColor: theme === 'light' \? '#E2E8F0' : 'var\(--border-subtle\)'/g, "borderColor: '#E2E8F0'");
code = code.replace(/color: theme === 'light' \? '#64748B' : 'var\(--text-\[#64748B\] dark:text-faint\)'/g, "color: '#64748B'");

// 1. Remove ALL dark classes
code = code.replace(/dark:hover:text-\[var\(--text-\[#0F172A\] dark:text-primary\)\]/g, "");
code = code.replace(/dark:[a-zA-Z0-9_\-\/]+/g, '');

// Clean up some residual spacing issues
code = code.replace(/  +/g, ' '); 

// 2. Fix the Time Group Headers ("TODAY", "YESTERDAY")
// The user explicitly stated: "Change the background of the "TODAY" and "YESTERDAY" horizontal tracks to a soft, light gray tint (#F1F5F9)."
// Currently it is: bg-slate-100 (which is #F1F5F9). But they also asked for a border under it.
// "Add a crisp, thin light border line (#E2E8F0) strictly under the section headers and between each item row"
code = code.replace(/<div className="px-5 py-2 sticky top-0 bg-slate-100 backdrop-blur-sm z-10">/g, '<div className="px-5 py-2 sticky top-0 bg-[#F1F5F9] border-b border-[#E2E8F0] backdrop-blur-sm z-10">');
// Re-replace in case it was mangled by space replacement:
code = code.replace(/<div className="px-5 py-2 sticky top-0 bg-slate-100 backdrop-blur-sm z-10">/g, '<div className="px-5 py-2 sticky top-0 bg-[#F1F5F9] border-b border-[#E2E8F0] backdrop-blur-sm z-10">');

// Text color for date headers (currently text-slate-500)
// The user said: Change their text color from white to a muted dark gray (#64748B)
code = code.replace(/className="text-\[9px\] uppercase text-slate-500 "/g, 'className="text-[9px] uppercase text-[#64748B]"');
code = code.replace(/className="text-\[9px\] uppercase text-slate-500"/g, 'className="text-[9px] uppercase text-[#64748B]"');


// 3. Notification Row Items
// Current className: `flex items-start gap-3 px-5 py-4 cursor-pointer transition-all duration-200 group border-b border-slate-100 hover:bg-slate-50 ${!notif.is_read ? 'bg-blue-50/50 ' : 'bg-transparent '}`
// The user wants:
// - border between each item row: border-b border-[#E2E8F0]
// - background transparent or uniform white. No dark gray block! (The bg-blue-50/50 might be turning dark gray in their browser, or maybe it was due to dark classes).
// Let's force it to bg-white or transparent.
code = code.replace(/className=\{\`flex items-start gap-3 px-5 py-4 cursor-pointer transition-all duration-200 group border-b border-slate-100 hover:bg-slate-50 \$\{.*?\`\}/, 
  "className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-all duration-200 group border-b border-[#E2E8F0] hover:bg-slate-50 ${!notif.is_read ? 'bg-blue-50/40' : 'bg-transparent'}`}"
);

// We should also replace the getIcon to ensure NO dark mode logic is inside.
code = code.replace(/const isLight = theme === 'light';/g, 'const isLight = true;');
code = code.replace(/theme === 'light' \? 'font-medium text-\[#334155\]' : 'font-medium text-secondary'/g, "'font-medium text-[#334155]'");

// Let's make sure the Header title text colors are correct. 
code = code.replace(/text-\[#0F172A\] /g, 'text-[#0F172A] ');

fs.writeFileSync('src/components/shared/NotificationsDrawer.jsx', code);
