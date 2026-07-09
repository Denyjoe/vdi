const fs = require('fs');
let code = fs.readFileSync('src/pages/public/LandingPage.jsx', 'utf8');

// 1. Base Canvas & Decorative
code = code.replace(/bg-\[#050B18\]/g, 'bg-[#F8FAFC]');
code = code.replace(/bg-indigo-600\/20 blur-\[120px\]/g, 'hidden');

// 2. High Contrast Typography & Headers
// Hero main heading
code = code.replace(/text-\[var\(--text-primary\)\] tracking-tight mb-8/g, 'text-[#0F172A] tracking-tight mb-8');
// Gradient text for Virtual Workspaces -> Deep solid blue
code = code.replace(/text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400/g, 'text-[#2563EB]');
// Hero subtext
code = code.replace(/text-\[var\(--text-secondary\)\] mb-12/g, 'text-[#334155] mb-12');
// Pill badge
code = code.replace(/bg-indigo-500\/10 border border-indigo-500\/20 text-indigo-300/g, 'bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8]');
code = code.replace(/bg-indigo-400/g, 'bg-[#2563EB]');
code = code.replace(/bg-indigo-500/g, 'bg-[#1D4ED8]'); // for the inner dot

// 3. Top Header Navigation Bar
code = code.replace(/bg-\[#050B18\]\/80 backdrop-blur-md/g, 'bg-[#F1F5F9]/90 backdrop-blur-md');
code = code.replace(/border-\[var\(--border-color\)\]/g, 'border-[#E2E8F0]');
// Logo
code = code.replace(/text-primary tracking-tight/g, 'text-[#334155] tracking-tight');
// Nav links
code = code.replace(/text-secondary border-transparent hover:text-white/g, 'text-[#334155] border-transparent hover:text-[#0F172A]');
code = code.replace(/text-secondary hover:text-white/g, 'text-[#334155] hover:text-[#0F172A]');
// Join Session navbar button
code = code.replace(/text-secondary hover:text-indigo-300/g, 'text-[#334155] hover:text-[#0F172A]');

// 4. Primary Call-to-Action Buttons
// Start for free
code = code.replace(/bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-\[var\(--text-primary\)\]/g, 'bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF]');
// Join with Code
code = code.replace(/bg-\[var\(--bg-card\)\] hover:bg-\[var\(--bg-card-hover\)\] text-\[var\(--text-primary\)\] border border-\[var\(--border-color\)\]/g, 'bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#1E293B] border border-slate-200');

// 5. Features Section blocks
code = code.replace(/bg-\[#080E1C\]/g, 'bg-[#FFFFFF]');
code = code.replace(/text-3xl font-bold text-\[var\(--text-primary\)\]/g, 'text-3xl font-bold text-[#0F172A]');
code = code.replace(/text-\[var\(--text-secondary\)\]/g, 'text-[#475569]');
// Card containers
code = code.replace(/bg-\[var\(--bg-primary\)\] border border-\[var\(--border-color\)\]/g, 'bg-[#FFFFFF] border border-[#E2E8F0] shadow-sm');
// Card Titles
code = code.replace(/text-xl font-bold text-\[var\(--text-primary\)\]/g, 'text-xl font-bold text-[#0F172A]');

// 6. Feature Action Icon Graphics
// Zap (Purple)
code = code.replace(/bg-indigo-500\/10 border border-indigo-500\/20/g, 'bg-[#F3E8FF] border border-[#E9D5FF]');
code = code.replace(/text-indigo-400/g, 'text-[#7E22CE]');
// Users (Cyan)
code = code.replace(/bg-cyan-500\/10 border border-cyan-500\/20/g, 'bg-[#E0F2FE] border border-[#BAE6FD]');
code = code.replace(/text-cyan-400/g, 'text-[#0369A1]');
// Shield (Green)
code = code.replace(/bg-emerald-500\/10 border border-emerald-500\/20/g, 'bg-[#DCFCE7] border border-[#BBF7D0]');
code = code.replace(/text-emerald-400/g, 'text-[#15803D]');

// Fix Pricing block styles so they don't break now
code = code.replace(/text-2xl font-bold text-\[var\(--text-primary\)\]/g, 'text-2xl font-bold text-[#0F172A]');
code = code.replace(/text-4xl font-bold text-\[var\(--text-primary\)\]/g, 'text-4xl font-bold text-[#0F172A]');
code = code.replace(/text-\[var\(--text-primary\)\]/g, 'text-[#0F172A]');

fs.writeFileSync('src/pages/public/LandingPage.jsx', code);
