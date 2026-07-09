const fs = require('fs');

// 1. SettingsPanel.jsx (Save Preferences button text-white)
let settings = fs.readFileSync('src/components/shared/SettingsPanel.jsx', 'utf8');
settings = settings.replace(/'bg-indigo-600 hover:bg-indigo-500 text-primary/g, "'bg-indigo-600 hover:bg-indigo-500 text-white");
settings = settings.replace(/'bg-emerald-500 hover:bg-emerald-600 text-primary/g, "'bg-emerald-500 hover:bg-emerald-600 text-white");
fs.writeFileSync('src/components/shared/SettingsPanel.jsx', settings);

// 2. JoinByCodeModal.jsx (Join Session button text-white)
let join = fs.readFileSync('src/components/shared/JoinByCodeModal.jsx', 'utf8');
join = join.replace(/bg-\[#0066FF\] text-primary/g, "bg-[#0066FF] text-white");
fs.writeFileSync('src/components/shared/JoinByCodeModal.jsx', join);

// 3. WorkspacesPage.jsx (Pills)
let work = fs.readFileSync('src/pages/member/WorkspacesPage.jsx', 'utf8');
work = work.replace(/activeFilter === tab\s*\?\s*'bg-\[#0066FF\] text-white shadow-lg shadow-blue-500\/30'\s*:\s*'bg-card text-secondary border border-border hover:border-slate-600 hover:text-white'/g, 
  "activeFilter === tab ? 'bg-[#2563EB] text-[#FFFFFF] shadow-md border border-[#2563EB]' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'");
// Add span wrapper to counter badges in the tab labels if they exist. Wait, the tabs are just strings in the array: ['All Nodes', 'Online', 'Offline', 'Provisioning'].
// We need to render the counter in a specific span. In the map:
// {['All Nodes', 'Online', 'Offline', 'Provisioning'].map(tab => (
//   <button key={tab} ...>{tab}</button>
// ))}
// The counter is usually NOT in the tab name natively unless it's concatenated. Let me check WorkspacesPage.jsx tabs rendering.
let tabsMatch = work.match(/\{\[\s*'All Nodes',\s*'Online',\s*'Offline',\s*'Provisioning'\s*\]\.map\(tab => \(\s*<button[\s\S]+?<\/button>\s*\)\)\}/);
if (tabsMatch) {
  let replacement = tabsMatch[0].replace(/>\s*\{tab\}\s*<\/button>/, 
    "> {tab} <span className=\"text-[#64748B] ml-1\">({tab === 'All Nodes' ? workspaces.length : tab === 'Online' ? workspaces.filter(w=>w.status==='active'||w.status==='running').length : tab === 'Offline' ? workspaces.filter(w=>w.status!=='active'&&w.status!=='running').length : 0})</span> </button>");
  work = work.replace(tabsMatch[0], replacement);
}
fs.writeFileSync('src/pages/member/WorkspacesPage.jsx', work);

// 4. DashboardPage.jsx (Telemetry cards)
let dash = fs.readFileSync('src/pages/DashboardPage.jsx', 'utf8');
// Fix CircularGauge
dash = dash.replace(/<text x="40" y="37" textAnchor="middle" fill="#E2E8F0" fontSize="14" fontWeight="700">/g, 
  '<text x="40" y="37" textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="700">');
dash = dash.replace(/<text x="40" y="50" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="500">/g, 
  '<text x="40" y="50" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="500">');
// Fix Hardware values (text-muted -> text-[#64748B])
dash = dash.replace(/<p className="text-\[10px\] text-muted mt-2 uppercase tracking-wider font-medium">/g, 
  '<p className="text-[10px] text-[#64748B] mt-2 uppercase tracking-wider font-medium">');
// Fix Card containers (bg-canvas/30 rounded-xl p-4 text-center) -> (bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl p-4 text-center)
dash = dash.replace(/bg-canvas\/30 rounded-xl/g, 'bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-xl');
// Fix Neon Green dot
dash = dash.replace(/bg-\[#00FF87\]/g, 'bg-[var(--status-online-dot, #16A34A)]');
dash = dash.replace(/text-\[#00FF87\]/g, 'text-[var(--status-online-text, #16A34A)]');
fs.writeFileSync('src/pages/DashboardPage.jsx', dash);

// 5. CreateSessionPage.jsx (Inputs text-white -> text-primary)
let cs = fs.readFileSync('src/pages/member/CreateSessionPage.jsx', 'utf8');
cs = cs.replace(/text-white outline-none/g, 'text-[var(--text-primary)] outline-none');
fs.writeFileSync('src/pages/member/CreateSessionPage.jsx', cs);

// 6. Navbar.jsx (WORKSHOP badge & LIVE)
let nav = fs.readFileSync('src/components/layout/Navbar.jsx', 'utf8');
// Fix WORKSHOP badge
nav = nav.replace(/<span className="px-2\.5 py-1 rounded-md bg-\[#111827\] text-\[10px\] font-bold text-slate-300 uppercase tracking-wider shadow-inner shadow-black\/50 border border-slate-700\/50">/g,
  '<span className="px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wider border border-[#DBEAFE]">');
// Wait, my regex might not exactly match the original string. Let me replace by finding 'WORKSHOP' span.
let wsSpanMatch = nav.match(/<span[^>]*>WORKSHOP<\/span>/i);
if (wsSpanMatch) {
  nav = nav.replace(wsSpanMatch[0], '<span className="px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wider border border-[#DBEAFE]">WORKSHOP</span>');
}
// Fix LIVE dot
nav = nav.replace(/bg-\[#00FF87\]/g, 'bg-[#16A34A]');
nav = nav.replace(/text-\[#00FF87\]/g, 'text-[#15803D]'); // Emerald for text
fs.writeFileSync('src/components/layout/Navbar.jsx', nav);
