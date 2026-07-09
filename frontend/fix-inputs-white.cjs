const fs = require('fs');
const { execSync } = require('child_process');

function fixInputsWhite() {
  const files = execSync('dir /s /b "c:\\Users\\Denis Wilson\\Desktop\\dit-vdi-system\\frontend\\src\\*.jsx"').toString().split('\r\n').filter(Boolean);
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // A simpler regex to find any <input, <textarea, <select and replace text-white
    content = content.replace(/(<(?:input|textarea|select)[^>]+className="[^"]*)\btext-white\b([^"]*"[^>]*>)/g, '$1text-primary$2');
    // Run twice in case there are multiple tags on the same line, wait, the regex uses [^>]+ which might match too greedily.

    // Let's use a split approach. Split by '<input', '<textarea', '<select', fix text-white, join.
    ['input', 'textarea', 'select'].forEach(tag => {
      let parts = content.split(`<${tag}`);
      for(let i=1; i<parts.length; i++) {
        let tagEndIndex = parts[i].indexOf('>');
        if(tagEndIndex !== -1) {
          let insideTag = parts[i].substring(0, tagEndIndex);
          if (insideTag.includes('text-white')) {
            parts[i] = insideTag.replace(/\btext-white\b/g, 'text-primary') + parts[i].substring(tagEndIndex);
          }
        }
      }
      content = parts.join(`<${tag}`);
    });

    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log('Fixed inputs text-white in', file);
    }
  });
}
fixInputsWhite();
