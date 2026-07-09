const fs = require('fs');

const files = ['src/pages/public/TermsPage.jsx', 'src/pages/public/PrivacyPage.jsx'];

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');

  // Backgrounds
  text = text.replace(/bg-\[#050B18\]/g, 'bg-[#F8FAFC]');
  text = text.replace(/bg-\[#050B18\]\/80/g, 'bg-[#F8FAFC]/80');
  
  // Borders
  text = text.replace(/border-\[var\(--border-color\)\]/g, 'border-[#E2E8F0]');
  
  // General text
  text = text.replace(/text-\[var\(--text-primary\)\]/g, 'text-[#1E293B]');
  
  // H1
  text = text.replace(/<h1 className="text-4xl font-bold mb-8">/g, '<h1 className="text-4xl font-bold mb-8 text-[#0F172A]">');
  
  // Navbar logo and texts
  text = text.replace(/<span className="text-xl font-bold tracking-tight">/g, '<span className="text-xl font-bold tracking-tight text-[#0F172A]">');
  text = text.replace(/text-sm font-medium hover:text-indigo-400/g, 'text-sm font-medium text-[#475569] hover:text-[#0F172A]');
  
  // Main prose block
  text = text.replace(/prose prose-invert prose-indigo max-w-none space-y-6 text-\[var\(--text-secondary\)\]/g, 'prose max-w-none space-y-6 text-[#334155]');
  
  // Last updated
  text = text.replace(/<p>Last updated:/g, '<p className="text-[#64748B]">Last updated:');
  
  // Footer text
  text = text.replace(/<span className="text-lg font-bold">/g, '<span className="text-lg font-bold text-[#0F172A]">');
  text = text.replace(/text-sm text-\[var\(--text-secondary\)\] hover:text-indigo-400/g, 'text-sm text-[#475569] hover:text-[#0F172A]');
  
  // Wrapper container (removing the initial text-[var(--text-primary)])
  // min-h-screen bg-[#F8FAFC] text-[var(--text-primary)] (replaced by previous rule) -> min-h-screen bg-[#F8FAFC] text-[#1E293B]
  // that's fine.

  fs.writeFileSync(file, text);
}
