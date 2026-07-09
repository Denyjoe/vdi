const fs = require('fs');
let code = fs.readFileSync('src/pages/auth/LoginPage.jsx', 'utf8');

// 1. Form Panel Background Wrapper
// Change bg-[#050B18] (line 117) to bg-[#FFFFFF]
code = code.replace(/bg-\[#050B18\]/g, 'bg-[#FFFFFF]');

// 2. High-Contrast Form Typography
// Main Header ("Sign In"): text-[var(--text-primary)] -> text-[#0F172A] (Line 125)
code = code.replace(/<h2 className="text-3xl font-bold text-\[var\(--text-primary\)\] mb-2 tracking-tight">Sign In<\/h2>/g, 
  '<h2 className="text-3xl font-bold text-[#0F172A] mb-2 tracking-tight">Sign In</h2>');

// Subheading text: text-[var(--text-secondary)] -> text-[#475569] (Line 126)
code = code.replace(/<p className="text-\[var\(--text-secondary\)\]">Enter your details to access your workspaces\.<\/p>/g,
  '<p className="text-[#475569]">Enter your details to access your workspaces.</p>');

// Form Labels: text-[var(--text-primary)] -> text-[#334155]
code = code.replace(/text-\[var\(--text-primary\)\]/g, 'text-[#334155]');

// "Forgot password?" Link: text-indigo-400 hover:text-indigo-300 -> text-[#2563EB] hover:text-[#1D4ED8]
code = code.replace(/text-indigo-400 hover:text-indigo-300/g, 'text-[#2563EB] hover:text-[#1D4ED8]');

// Logo color on right panel (if it exists)
// line 121: <span className="text-xl font-bold text-[var(--text-primary)]">CloudDesk</span> (which is now text-[#334155])

// 3. Input Fields & Placeholders
// bg-white/5 border border-[var(--border-color)] -> bg-[#FFFFFF] border border-[#E2E8F0]
code = code.replace(/bg-white\/5 border border-\[var\(--border-color\)\]/g, 'bg-[#FFFFFF] border border-[#E2E8F0]');
// placeholder-muted -> placeholder-[#94A3B8]
code = code.replace(/placeholder-muted/g, 'placeholder-[#94A3B8]');

// 4. "OR" Divider Line & Google Button
// border-[var(--border-color)] -> border-[#E2E8F0]
code = code.replace(/border-\[var\(--border-color\)\]/g, 'border-[#E2E8F0]');
// bg-[var(--bg-card)] text-muted -> bg-[#FFFFFF] text-[#64748B]
code = code.replace(/bg-\[var\(--bg-card\)\] text-muted/g, 'bg-[#FFFFFF] text-[#64748B]');

// Bottom Action Link ("New to CloudDesk?...")
// text-[var(--text-secondary)] -> text-[#0F172A]
code = code.replace(/text-\[var\(--text-secondary\)\]/g, 'text-[#0F172A]');

fs.writeFileSync('src/pages/auth/LoginPage.jsx', code);
