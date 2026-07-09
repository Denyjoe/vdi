import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace undefined background colors
content = content.replace("bg-[var(--bg-primary)]/50", "bg-[var(--bg-nav-hover)]")
content = content.replace("bg-[var(--bg-primary)]/80", "bg-[var(--bg-nav-hover)]")
content = content.replace("bg-[var(--bg-primary)]/30", "bg-[var(--bg-nav-hover)]")
content = content.replace("bg-[var(--bg-primary)]", "bg-[var(--bg-input)]")
content = content.replace("bg-[var(--bg-card-hover)]", "bg-[var(--bg-nav-hover)]")

# Fix missing text-muted class
content = content.replace("className=\"text-muted", "className=\"text-[var(--text-muted)]")
content = content.replace(" text-muted", " text-[var(--text-muted)]")

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
