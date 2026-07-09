const fs = require('fs');
const { execSync } = require('child_process');

function fixRemaining() {
  const files = execSync('dir /s /b "c:\\Users\\Denis Wilson\\Desktop\\dit-vdi-system\\frontend\\src\\*.jsx"').toString().split('\r\n').filter(Boolean);
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Remove text-white from body/main containers
    content = content.replace(/min-h-screen([^>]*)text-white/g, 'min-h-screen$1text-primary');
    
    // Replace text-white in inputs, selects, textareas
    content = content.replace(/<(input|textarea|select)([^>]+)className="([^"]+)"([^>]*)>/g, (match, tag, before, className, after) => {
      let newClass = className.replace(/\btext-white\b/g, 'text-primary');
      newClass = newClass.replace(/\btext-slate-[0-9]{3}\b/g, 'text-secondary');
      return `<${tag}${before}className="${newClass}"${after}>`;
    });

    // Replace <Icon className="... text-white" />
    content = content.replace(/<(Icon|[A-Z][a-zA-Z]*Icon)([^>]+)className="([^"]*)text-white([^"]*)"/g, '<$1$2className="$3text-primary$4"');

    // Handle `text-[var(--text-white)]` which might be problematic
    content = content.replace(/text-\[var\(--text-white\)]/g, 'text-primary');

    // Let's replace any `text-white` inside `label` tags
    content = content.replace(/<label([^>]*?)className="([^"]*?)text-white([^"]*?)"/g, '<label$1className="$2text-primary$3"');

    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log('Fixed remaining text-white in', file);
    }
  });
}
fixRemaining();
