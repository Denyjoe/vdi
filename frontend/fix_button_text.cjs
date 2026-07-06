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
      
      // Fix instances where a dark background like bg-indigo-600 or bg-indigo-500 or bg-emerald-600
      // has text-[var(--text-primary)]
      
      // We will look for className="... text-[var(--text-primary)] ... bg-indigo-..."
      // Using regex to replace text-[var(--text-primary)] with text-white if bg-indigo-500 or bg-indigo-600 is in the same string
      
      content = content.replace(/(className\s*=\s*(?:\{`|"[^"]*|'[^']*))([^`"']*)(`|"|')/g, (match, prefix, classList, suffix) => {
        if (
            classList.includes('bg-indigo-500') || 
            classList.includes('bg-indigo-600') ||
            classList.includes('bg-emerald-500') ||
            classList.includes('bg-emerald-600') ||
            classList.includes('bg-blue-500') ||
            classList.includes('bg-blue-600') ||
            classList.includes('bg-red-500') ||
            classList.includes('bg-red-600')
           ) {
          
          // But only if it's NOT a light version like bg-indigo-500/10 or bg-indigo-500/20!
          // We can check if it contains a dark bg without /opacity
          const hasSolidDarkBg = /\bbg-(indigo|emerald|blue|red|green|purple)-(500|600)\b(?!\/)/.test(classList);
          
          if (hasSolidDarkBg) {
             let newClassList = classList.replace(/text-\[var\(--text-primary\)\]/g, 'text-white');
             return prefix + newClassList + suffix;
          }
        }
        return match;
      });

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Fixed button text color in ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
console.log("Done fixing button texts.");
