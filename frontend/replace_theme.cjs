const fs = require('fs');
const path = require('path');

const replacements = [
  { regex: /bg-\[\#1e2d3d\]/g, replacement: 'bg-[var(--bg-card)]' },
  { regex: /bg-slate-900/g, replacement: 'bg-[var(--bg-primary)]' },
  { regex: /bg-slate-800/g, replacement: 'bg-[var(--bg-card)]' },
  { regex: /bg-slate-700/g, replacement: 'bg-[var(--bg-card-hover)]' },
  { regex: /text-slate-300/g, replacement: 'text-[var(--text-primary)]' },
  { regex: /text-slate-400/g, replacement: 'text-[var(--text-secondary)]' },
  { regex: /text-white/g, replacement: 'text-[var(--text-primary)]' },
  { regex: /border-slate-700/g, replacement: 'border-[var(--border-color)]' },
  { regex: /border-slate-800/g, replacement: 'border-[var(--border-color)]' },
  { regex: /border-white\/5/g, replacement: 'border-[var(--border-color)]' },
  { regex: /border-white\/10/g, replacement: 'border-[var(--border-color)]' },
  { regex: /style=\{\{ backgroundColor: ['"]#1e2d3d['"] \}\}/g, replacement: "style={{ backgroundColor: 'var(--bg-card)' }}" },
  { regex: /style=\{\{ color: ['"]#e2e8f0['"] \}\}/g, replacement: "style={{ color: 'var(--text-primary)' }}" }
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
      
      for (const r of replacements) {
        content = content.replace(r.regex, r.replacement);
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
