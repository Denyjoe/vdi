const fs = require('fs');
const { execSync } = require('child_process');

function fixBgSlate() {
  const files = execSync('dir /s /b "c:\\Users\\Denis Wilson\\Desktop\\dit-vdi-system\\frontend\\src\\pages\\member\\*.jsx"').toString().split('\r\n').filter(Boolean);
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    content = content.replace(/bg-slate-800\/20/g, 'bg-[var(--bg-nav-hover)]');
    content = content.replace(/bg-slate-800/g, 'bg-[var(--bg-elevated)]');
    content = content.replace(/bg-slate-700/g, 'bg-[var(--border-strong)]');
    
    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log('Fixed bg-slate in', file);
    }
  });
}
fixBgSlate();
