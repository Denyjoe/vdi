const fs = require('fs');
let jm = fs.readFileSync('src/components/shared/JoinByCodeModal.jsx', 'utf8');
jm = jm.replace(/className="w-full bg-card border-2 border-border rounded-xl px-5 py-4 text-center text-2xl font-mono font-bold text-white/g, 'className="w-full bg-card border-2 border-border rounded-xl px-5 py-4 text-center text-2xl font-mono font-bold text-[var(--text-primary)]');
jm = jm.replace(/className="w-full bg-card border-2 border-border rounded-xl pl-10 pr-4 py-3 text-sm text-white/g, 'className="w-full bg-card border-2 border-border rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text-primary)]');
fs.writeFileSync('src/components/shared/JoinByCodeModal.jsx', jm);
