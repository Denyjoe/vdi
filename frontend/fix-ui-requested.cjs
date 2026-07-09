const fs = require('fs');

// 1. Sidebar NavItem
let sidebar = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');
sidebar = sidebar.replace(/function NavItem[\s\S]+?return \([\s\S]+?<\/Link>\s*\);/, '');
// Wait, my regex before failed to match NavItem completely. Let's use string replacement.
sidebar = sidebar.replace(/<button onClick={handleClick}\s+style={{[\s\S]+?}}\s+className={`w-full flex items-center rounded-xl transition-all duration-200 active:scale-\[0\.97\] group relative \${collapsed \? 'justify-center p-2\.5' : 'gap-2\.5 px-3 py-2\.5'} hover:bg-\[var\(--bg-nav-hover\)\] hover:text-\[var\(--text-primary\)\]`}/, 
  `<button onClick={handleClick}
      className={\`w-full flex items-center rounded-xl transition-all duration-200 active:scale-[0.97] group relative \${collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5'} \${active ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-nav-hover)] hover:text-[var(--text-primary)] font-medium'}\`}`);

// Collapse button
sidebar = sidebar.replace(/className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-\[#1E293B\] border border-border-strong flex items-center justify-center text-secondary hover:text-white hover:bg-\[#0066FF\] hover:border-\[#0066FF\] active:scale-90 transition-all duration-200 z-10 shadow-lg shadow-black\/30"/,
  'className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-nav-hover)] hover:border-[var(--border-strong)] active:scale-90 transition-all duration-200 z-10 shadow-md"');

fs.writeFileSync('src/components/layout/Sidebar.jsx', sidebar);

// 2. JoinByCodeModal
let join = fs.readFileSync('src/components/shared/JoinByCodeModal.jsx', 'utf8');
join = join.replace(/className="w-full bg-card border-2 border-border rounded-xl px-5 py-4 text-center text-2xl font-mono font-bold text-white tracking-\[0\.5em\]/g, 'className="w-full bg-card border-2 border-border rounded-xl px-5 py-4 text-center text-2xl font-mono font-bold text-primary tracking-[0.5em]');
fs.writeFileSync('src/components/shared/JoinByCodeModal.jsx', join);

// 3. Navbar (Quick Start / Shortcuts)
let navbar = fs.readFileSync('src/components/layout/Navbar.jsx', 'utf8');
navbar = navbar.replace(/bg-slate-800 text-secondary/g, 'bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-primary)]');
navbar = navbar.replace(/bg-slate-800\/70/g, 'bg-[var(--bg-elevated)]');
fs.writeFileSync('src/components/layout/Navbar.jsx', navbar);

// 4. Terms and Privacy
['src/pages/public/TermsPage.jsx', 'src/pages/public/PrivacyPage.jsx'].forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/bg-\[#080B10\]/g, 'bg-canvas');
    content = content.replace(/bg-\[#0B1221\]/g, 'bg-card');
    content = content.replace(/bg-\[#111827\]/g, 'bg-elevated');
    content = content.replace(/text-white/g, 'text-primary');
    content = content.replace(/text-slate-300/g, 'text-secondary');
    content = content.replace(/text-slate-400/g, 'text-muted');
    fs.writeFileSync(file, content);
  }
});

// 5. RegisterPage / SettingsPanel Name inputs
['src/pages/auth/RegisterPage.jsx', 'src/components/shared/SettingsPanel.jsx'].forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/text-white/g, 'text-primary'); // Generic fix for inputs if missed
    fs.writeFileSync(file, content);
  }
});

// 6. SettingsPanel Developer Token
let settings = fs.readFileSync('src/components/shared/SettingsPanel.jsx', 'utf8');
settings = settings.replace(/className="flex-1 bg-sidebar px-4 py-3 rounded-xl text-xs font-mono text-white/g, 'className="flex-1 bg-input px-4 py-3 rounded-xl text-xs font-mono text-primary');
// Ensure no other text-white remained in SettingsPanel (wait, buttons might need it)
settings = settings.replace(/bg-black\/50/g, 'bg-[var(--bg-card)]');
fs.writeFileSync('src/components/shared/SettingsPanel.jsx', settings);

console.log('Fixed requested UI files');
