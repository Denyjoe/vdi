const fs = require('fs');
let text = fs.readFileSync('src/components/shared/NotificationsDrawer.jsx', 'utf8');

// Container base
text = text.replace(/background: 'rgba\(10, 14, 20, 0\.92\)'/g, "background: theme === 'light' ? 'rgba(248, 250, 252, 0.96)' : 'rgba(10, 14, 20, 0.92)'");
text = text.replace(/borderLeft: '1px solid rgba\(255,255,255,0\.06\)'/g, "borderLeft: theme === 'light' ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.06)'");

// Read title text (currently text-secondary)
text = text.replace(/'font-medium text-secondary'/g, "theme === 'light' ? 'font-medium text-[#334155]' : 'font-medium text-secondary'");

// Empty state header
text = text.replace(/text-\[13px\] font-semibold text-secondary/g, 'text-[13px] font-semibold text-[#0F172A] dark:text-secondary');

// Header border
text = text.replace(/border-b border-white\/\[0\.06\]/g, 'border-b border-[#E2E8F0] dark:border-white/[0.06]');

fs.writeFileSync('src/components/shared/NotificationsDrawer.jsx', text);
