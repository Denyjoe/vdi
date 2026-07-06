const fs = require('fs');
const path = require('path');

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
      
      // Simple text replace for buttons
      // We will look for bg-indigo-600 (or similar) AND text-[var(--text-primary)] on the same line
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
          if (
              (lines[i].includes('bg-indigo-500') || lines[i].includes('bg-indigo-600') || lines[i].includes('bg-emerald-500') || lines[i].includes('bg-blue-600')) &&
              !lines[i].includes('/10') && !lines[i].includes('/20') && !lines[i].includes('bg-indigo-500/10')
          ) {
              if (lines[i].includes('text-[var(--text-primary)]')) {
                  lines[i] = lines[i].replace(/text-\[var\(--text-primary\)\]/g, 'text-white');
              }
          }
      }
      content = lines.join('\n');

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Fixed button text color in ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
console.log("Done fixing button texts (v2).");
