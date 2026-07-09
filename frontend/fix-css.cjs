const fs = require('fs');
let content = fs.readFileSync('src/index.css', 'utf8');

const lightThemeReplacement = `[data-theme="light"] {
  /* Text — HIGH CONTRAST */
  --text-primary: #0F172A;
  --text-secondary: #334155;
  --text-muted: #475569;
  --text-faint: #64748B;
  
  /* Backgrounds */
  --bg-canvas: #F8FAFC;
  --bg-sidebar: #F1F5F9;
  --bg-card: #FFFFFF;
  --bg-elevated: #FFFFFF;
  --bg-input: #F8FAFC;
  --bg-nav-hover: #F1F5F9;
  
  /* Borders */
  --border-color: #E2E8F0;
  --border-subtle: #F1F5F9;
  --border-strong: #CBD5E1;
  
  /* Accents */
  --accent-primary: #2563EB;
  --accent-primary-hover: #1D4ED8;
  --accent-primary-soft: #EFF6FF;
  --accent-primary-tint: #DBEAFE;
  
  --accent-purple: #6C63FF;
  --accent-purple-soft: #F5F3FF;
  
  /* Status colors — DEEP for contrast */
  --status-online: #15803D;
  --status-online-text: #166534;
  --status-online-bg: #DCFCE7;
  --status-online-dot: #16A34A;
  
  --status-warning: #B45309;
  --status-warning-bg: #FEF3C7;
  --status-warning-dot: #D97706;
  
  --status-info: #0369A1;
  --status-info-bg: #E0F2FE;
  --status-info-dot: #0284C7;
  
  --status-error: #B91C1C;
  --status-error-bg: #FEE2E2;
  --status-error-dot: #DC2626;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(15, 23, 42, 0.05), 0 1px 3px 0 rgba(15, 23, 42, 0.08);
  --shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08);
  --shadow-blue: 0 4px 12px rgba(37, 99, 235, 0.25);
    
  --led-opacity: 0.35;
  --led-blur: 2px;
}`;

content = content.replace(/\[data-theme="light"\] \{[\s\S]*?(?=\}\n\n@theme)/, lightThemeReplacement);

// Also add to @theme block
if(!content.includes('--color-faint: var(--text-faint)')) {
    content = content.replace(/--color-muted: var\(--text-muted\);/, '--color-muted: var(--text-muted);\n  --color-faint: var(--text-faint);');
}
if(!content.includes('--color-border-strong: var(--border-strong)')) {
    content = content.replace(/--color-border-subtle: var\(--border-subtle\);/, '--color-border-subtle: var(--border-subtle);\n  --color-border-strong: var(--border-strong);');
}
if(!content.includes('--color-nav-hover: var(--bg-nav-hover)')) {
    content = content.replace(/--color-input: var\(--bg-input\);/, '--color-input: var(--bg-input);\n  --color-nav-hover: var(--bg-nav-hover);');
}

fs.writeFileSync('src/index.css', content);
