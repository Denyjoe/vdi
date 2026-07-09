const fs = require('fs');
const { execSync } = require('child_process');

function processFiles() {
  const files = execSync('dir /s /b "c:\\Users\\Denis Wilson\\Desktop\\dit-vdi-system\\frontend\\src\\*.jsx"').toString().split('\r\n').filter(Boolean);
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Text classes
    content = content.replace(/text-slate-100/g, 'text-primary');
    content = content.replace(/text-slate-200/g, 'text-primary');
    content = content.replace(/text-slate-300/g, 'text-secondary');
    content = content.replace(/text-slate-400/g, 'text-secondary');
    content = content.replace(/text-slate-500/g, 'text-muted');
    content = content.replace(/text-slate-600/g, 'text-faint');
    content = content.replace(/text-slate-700/g, 'text-faint');
    
    // DashboardPage Welcome Banner heading & subtitle:
    content = content.replace(/text-2xl sm:text-3xl font-bold text-primary tracking-tight/g, 'text-2xl sm:text-3xl font-bold text-primary tracking-tight');
    content = content.replace(/text-sm text-secondary mt-2 max-w-md/g, 'text-sm text-secondary mt-2 max-w-md');

    // Stat cards value:
    content = content.replace(/text-xl font-bold text-white mt-0\.5/g, 'text-xl font-bold text-primary mt-0.5');
    
    // Active workspace text
    content = content.replace(/text-sm font-bold text-white uppercase tracking-wide/g, 'text-sm font-bold text-primary uppercase tracking-wide');
    content = content.replace(/text-base font-bold text-white/g, 'text-base font-bold text-primary');
    
    // Borders
    content = content.replace(/border-slate-800\/50/g, 'border-border');
    content = content.replace(/border-slate-800\/30/g, 'border-border-subtle');
    content = content.replace(/border-slate-700\/50/g, 'border-border-strong');
    
    // Backgrounds
    content = content.replace(/bg-slate-900\/50/g, 'bg-canvas');
    content = content.replace(/bg-slate-900/g, 'bg-canvas');
    content = content.replace(/bg-slate-800\/50/g, 'bg-nav-hover');
    content = content.replace(/bg-slate-800\/40/g, 'bg-nav-hover');
    
    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log('Modified', file);
    }
  });
}
processFiles();
