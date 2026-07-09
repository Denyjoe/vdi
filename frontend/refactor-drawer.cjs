const fs = require('fs');
let text = fs.readFileSync('src/components/shared/NotificationsDrawer.jsx', 'utf8');

// 1. Update getIcon
text = text.replace(/const getIcon = \(type\) => \{[\s\S]*?return icons\[type\] \|\| icons\.system;\n  \};/, 
`const getIcon = (type) => {
    const isLight = theme === 'light';
    const icons = {
      workspace_ready: { icon: Monitor, color: isLight ? '#15803D' : '#00FF87', bg: isLight ? '#DCFCE7' : '#00FF8715' },
      hours_low: { icon: Clock, color: '#FF6B00', bg: '#FF6B0015' },
      payment_confirmed: { icon: CreditCard, color: '#6C63FF', bg: '#6C63FF15' },
      session_invite: { icon: Users, color: '#00A3FF', bg: '#00A3FF15' },
      workspace_stopped: { icon: Zap, color: isLight ? '#B91C1C' : '#FF3366', bg: isLight ? '#FEE2E2' : '#FF336615' },
      system: { icon: Megaphone, color: '#64748B', bg: '#64748B15' },
    };
    return icons[type] || icons.system;
  };`);

// 2. Base Container
text = text.replace(/bg-\[#0A0E14\]/g, 'bg-[#F8FAFC] dark:bg-[#0A0E14]');
text = text.replace(/border-border-subtle/g, 'border-[#E2E8F0] dark:border-border-subtle');
// Change dynamic style bindings for border-subtle
text = text.replace(/borderColor: 'var\(--border-subtle\)'/g, "borderColor: theme === 'light' ? '#E2E8F0' : 'var(--border-subtle)'");
text = text.replace(/borderBottom: '1px solid var\(--border-subtle\)'/g, "borderBottom: theme === 'light' ? '1px solid #E2E8F0' : '1px solid var(--border-subtle)'");

// 3. Header Texts
text = text.replace(/<span className="text-xs font-semibold text-primary px-2 py-0\.5 rounded-md bg-\[#0066FF\]\/10">/g, '<span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#0066FF]/10 text-[#475569] dark:text-primary">');
text = text.replace(/text-secondary hover:text-\[var\(--text-primary\)\]/g, 'text-[#334155] dark:text-secondary hover:text-[#0F172A] dark:hover:text-[var(--text-primary)]');

// Notification row titles:
text = text.replace(/text-primary/g, 'text-[#0F172A] dark:text-primary');

// 4. Tabs
text = text.replace(/className={`px-3 py-1\.5 rounded-full text-\[11px\] font-semibold transition-all duration-200 active:scale-95 \$\{[\s\S]*?\}`}/, 
`className={\`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 active:scale-95 \${
                filter === f
                  ? (theme === 'light' ? 'bg-[#2563EB] text-[#FFFFFF]' : 'bg-[#0066FF]/15 text-[#0066FF]')
                  : (theme === 'light' ? 'text-[#475569] hover:bg-[#E2E8F0]' : 'hover:text-primary hover:bg-[var(--bg-nav-hover)]')
              }\`}`);
// Active text color in style block of tabs
text = text.replace(/color: filter === f \? 'var\(--accent-primary\)' : 'var\(--text-muted\)'/g, "color: undefined");

// 5. Date Header
text = text.replace(/bg-\[var\(--bg-\[var\(--bg-card\)\]\)\]\/80/g, 'bg-[#F1F5F9] dark:bg-[#111827]');
text = text.replace(/color: 'var\(--text-faint\)'/g, "color: theme === 'light' ? '#64748B' : 'var(--text-faint)'");

// 6. Notification Text & Subtext
text = text.replace(/text-muted/g, 'text-[#475569] dark:text-muted');
text = text.replace(/text-faint/g, 'text-[#64748B] dark:text-faint');

// 7. Unread Dot
text = text.replace(/bg-\[#0066FF\] border-2 border-\[#0A0E14\]/g, 'bg-[#2563EB] border-2 border-[#F8FAFC] dark:border-[#0A0E14]');

// 8. Row Backgrounds (transparent or white)
text = text.replace(/background: !notif\.is_read[\s\S]*?: 'transparent'/g, 
`background: !notif.is_read 
                              ? (theme === 'light' ? 'rgba(37, 99, 235, 0.04)' : 'rgba(0, 102, 255, 0.03)') 
                              : (theme === 'light' ? '#FFFFFF' : 'transparent')`);

fs.writeFileSync('src/components/shared/NotificationsDrawer.jsx', text);
