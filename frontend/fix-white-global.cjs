const fs = require('fs');
const { execSync } = require('child_process');

function fixTextWhite() {
  const files = execSync('dir /s /b "c:\\Users\\Denis Wilson\\Desktop\\dit-vdi-system\\frontend\\src\\*.jsx"').toString().split('\r\n').filter(Boolean);
  
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Fix placeholder-slate-* and placeholder-white
    content = content.replace(/placeholder-slate-[0-9]{3}/g, 'placeholder-slate-400');
    content = content.replace(/placeholder-white/g, 'placeholder-slate-400');
    
    // Fix text-white inside inputs directly (just in case)
    // A bit risky with regex, but we can target `<input ... className="... text-white ..."`
    content = content.replace(/(<input[^>]*className="[^"]*)text-white([^"]*")/g, '$1text-primary$2');
    content = content.replace(/(<textarea[^>]*className="[^"]*)text-white([^"]*")/g, '$1text-primary$2');
    content = content.replace(/(<select[^>]*className="[^"]*)text-white([^"]*")/g, '$1text-primary$2');

    // Also globally replace text-white in standard text tags across all files
    content = content.replace(/<(h[1-6]|p|span|div)([^>]*?)className="([^"]*?)text-white([^"]*?)"/g, '<$1$2className="$3text-primary$4"');
    content = content.replace(/<(h[1-6]|p|span|div)([^>]*?)className="([^"]*?)text-white([^"]*?)"/g, '<$1$2className="$3text-primary$4"');

    // Revert text-primary back to text-white if it is inside a button or tag that explicitly has a dark background
    // (like bg-indigo-500, bg-indigo-600, bg-[#0066FF], bg-blue-600, bg-red-500, bg-emerald-500, etc.)
    // Actually, it's safer to just let the script run and we can check. Wait, my regex explicitly looks for <h1, <p, <span, <div
    // Buttons are <button> or <Link>. So text-white inside <button className="bg-indigo-600 text-white"> is UNAFFECTED!
    // What if it's <span className="bg-indigo-500 text-white">? The regex above changed it to text-primary.
    // Let's restore text-white for anything with bg-indigo, bg-blue, bg-red, bg-emerald, bg-[#0066FF]
    
    content = content.replace(/(bg-indigo-[56]00[^"]*)text-primary/g, '$1text-white');
    content = content.replace(/(bg-\[#0066FF\][^"]*)text-primary/g, '$1text-white');
    content = content.replace(/(bg-blue-[56]00[^"]*)text-primary/g, '$1text-white');
    content = content.replace(/(bg-red-[56]00[^"]*)text-primary/g, '$1text-white');
    content = content.replace(/(bg-emerald-[56]00[^"]*)text-primary/g, '$1text-white');
    content = content.replace(/(text-primary)([^"]*bg-indigo-[56]00)/g, 'text-white$2');
    content = content.replace(/(text-primary)([^"]*bg-\[#0066FF\])/g, 'text-white$2');

    // For any text-slate-[12345] that should be secondary or muted
    // But user only asked for text-white and placeholder.

    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log('Fixed text-white and placeholders in', file);
    }
  });
}
fixTextWhite();
