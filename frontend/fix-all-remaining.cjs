const fs = require('fs');
const { execSync } = require('child_process');

function fixAllRemaining() {
  const files = execSync('dir /s /b "c:\\Users\\Denis Wilson\\Desktop\\dit-vdi-system\\frontend\\src\\*.jsx"').toString().split('\r\n').filter(Boolean);
  
  files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    let original = c;
    
    // Fix placeholders
    c = c.replace(/placeholder-slate-400/g, 'placeholder-muted');
    c = c.replace(/placeholder-slate-500/g, 'placeholder-muted');
    c = c.replace(/placeholder-white/g, 'placeholder-muted');

    // Fix stray white text on main wrappers
    c = c.replace(/min-h-screen([^>]*)text-white/g, 'min-h-screen$1text-primary');
    c = c.replace(/text-white([^>]*)selection:bg-/g, 'text-primary$1selection:bg-');
    
    // Also, text-slate-300 should be text-secondary
    c = c.replace(/text-slate-300/g, 'text-secondary');

    if (c !== original) {
      fs.writeFileSync(f, c);
      console.log('Fixed', f);
    }
  });
}
fixAllRemaining();
