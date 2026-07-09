const fs = require('fs');
const { execSync } = require('child_process');

function fixTextWhite() {
  const files = execSync('dir /s /b "c:\\Users\\Denis Wilson\\Desktop\\dit-vdi-system\\frontend\\src\\pages\\member\\*.jsx"').toString().split('\r\n').filter(Boolean);
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace text-white in standard text tags (h1-h6, p, span, div) with text-primary
    content = content.replace(/<(h[1-6]|p|span|div)([^>]*?)className="([^"]*?)text-white([^"]*?)"/g, '<$1$2className="$3text-primary$4"');
    
    // Also run a second time in case there are multiple matches or overlaps
    content = content.replace(/<(h[1-6]|p|span|div)([^>]*?)className="([^"]*?)text-white([^"]*?)"/g, '<$1$2className="$3text-primary$4"');
    
    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log('Fixed text-white (including div) in', file);
    }
  });
}
fixTextWhite();
