const fs = require('fs');
let code = fs.readFileSync('src/components/shared/SettingsPanel.jsx', 'utf8');

// 1. Fix Country button inline style
// Original: style={{ color: form.country ? '#E2E8F0' : '#64748B' }}>
// It should use CSS variables so it supports both light and dark modes.
code = code.replace(/style=\{\{ color: form\.country \? '#E2E8F0' : '#64748B' \}\}/g, 
  "style={{ color: form.country ? 'var(--text-primary)' : 'var(--text-secondary)' }}");

// 2. Fix buttons text color (text-primary -> text-white on blue buttons)

// Save Changes button:
code = code.replace(/'bg-\[#0066FF\] text-primary hover:bg-\[#0052CC\] shadow-lg shadow-blue-500\/20'\}/g,
  "'bg-[#0066FF] text-white hover:bg-[#0052CC] shadow-lg shadow-blue-500/20'}");

// Update Password button:
code = code.replace(/bg-\[#0066FF\] text-primary text-sm font-semibold hover:bg-\[#0052CC\]/g,
  "bg-[#0066FF] text-white text-sm font-semibold hover:bg-[#0052CC]");

// Save Preferences button:
code = code.replace(/'bg-\[#0066FF\] text-primary hover:bg-\[#0052CC\]'\}/g,
  "'bg-[#0066FF] text-white hover:bg-[#0052CC]'}");

fs.writeFileSync('src/components/shared/SettingsPanel.jsx', code);
