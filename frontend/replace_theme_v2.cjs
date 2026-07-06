const fs = require('fs');
const path = require('path');

const globalReplacements = [
  // Backgrounds - Inline Styles
  { regex: /backgroundColor:\s*['"]#1e2d3d['"]/g, replacement: "backgroundColor: 'var(--bg-card)'" },
  { regex: /backgroundColor:\s*['"]#0f1923['"]/g, replacement: "backgroundColor: 'var(--bg-primary)'" },
  { regex: /backgroundColor:\s*['"]#1a2332['"]/g, replacement: "backgroundColor: 'var(--bg-secondary)'" },
  { regex: /backgroundColor:\s*['"]#243447['"]/g, replacement: "backgroundColor: 'var(--bg-card-hover)'" },
  
  // Backgrounds - Tailwind Arbitrary values
  { regex: /bg-\[\#1e2d3d\]/g, replacement: "bg-[var(--bg-card)]" },
  { regex: /bg-\[\#0f1923\]/g, replacement: "bg-[var(--bg-primary)]" },
  { regex: /bg-\[\#1a2332\]/g, replacement: "bg-[var(--bg-secondary)]" },
  { regex: /bg-\[\#243447\]/g, replacement: "bg-[var(--bg-card-hover)]" },

  // Text - Inline Styles
  { regex: /color:\s*['"]#e2e8f0['"]/g, replacement: "color: 'var(--text-primary)'" },
  { regex: /color:\s*['"]#f1f5f9['"]/g, replacement: "color: 'var(--text-heading)'" },
  { regex: /color:\s*['"]#94a3b8['"]/g, replacement: "color: 'var(--text-secondary)'" },
  { regex: /color:\s*['"]#64748b['"]/g, replacement: "color: 'var(--text-muted)'" },
  
  // Text - Tailwind Arbitrary values
  { regex: /text-\[\#e2e8f0\]/g, replacement: "text-[var(--text-primary)]" },
  { regex: /text-\[\#f1f5f9\]/g, replacement: "text-[var(--text-heading)]" },
  { regex: /text-\[\#94a3b8\]/g, replacement: "text-[var(--text-secondary)]" },
  { regex: /text-\[\#64748b\]/g, replacement: "text-[var(--text-muted)]" },

  // Borders - Inline Styles
  { regex: /border:\s*['"]1px solid rgba\(255,\s*255,\s*255,\s*0\.05\)['"]/g, replacement: "border: '1px solid var(--border-card)'" },
  { regex: /border:\s*['"]1px solid rgba\(255,\s*255,\s*255,\s*0\.08\)['"]/g, replacement: "border: '1px solid var(--border-color)'" },
  { regex: /border:\s*['"]1px solid rgba\(255,\s*255,\s*255,\s*0\.1\)['"]/g, replacement: "border: '1px solid var(--border-input)'" },
  
  // Also common Tailwind colors to variables (some done previously, just ensuring)
  { regex: /bg-slate-900/g, replacement: 'bg-[var(--bg-primary)]' },
  { regex: /bg-slate-800/g, replacement: 'bg-[var(--bg-card)]' },
  { regex: /bg-slate-700/g, replacement: 'bg-[var(--bg-card-hover)]' },
  { regex: /text-slate-300/g, replacement: 'text-[var(--text-primary)]' },
  { regex: /text-slate-400/g, replacement: 'text-[var(--text-secondary)]' },
  { regex: /text-white/g, replacement: 'text-[var(--text-primary)]' },
  { regex: /border-slate-700/g, replacement: 'border-[var(--border-color)]' },
  { regex: /border-slate-800/g, replacement: 'border-[var(--border-color)]' },
  { regex: /border-white\/5/g, replacement: 'border-[var(--border-card)]' },
  { regex: /border-white\/10/g, replacement: 'border-[var(--border-input)]' }
];

const sidebarReplacements = [
  { regex: /bg-\[var\(--bg-primary\)\]/g, replacement: 'bg-[var(--bg-sidebar)]' },
  { regex: /backgroundColor:\s*['"]var\(--bg-primary\)['"]/g, replacement: "backgroundColor: 'var(--bg-sidebar)'" },
  { regex: /backgroundColor:\s*['"]#0f1923['"]/g, replacement: "backgroundColor: 'var(--bg-sidebar)'" }
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;
      
      // Apply global replacements
      for (const r of globalReplacements) {
        content = content.replace(r.regex, r.replacement);
      }
      
      // If sidebar, apply sidebar overrides
      if (file === 'Sidebar.jsx') {
        for (const r of sidebarReplacements) {
          content = content.replace(r.regex, r.replacement);
        }
      }
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
console.log("Done.");
