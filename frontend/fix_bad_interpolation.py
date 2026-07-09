with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("const response = await fetch(/api/admin/backup/download//, {", "const response = await fetch(/api/admin/backup/download//, {")
content = content.replace("const res = await api.post(/admin/api-tokens//revoke/);", "const res = await api.post(/admin/api-tokens//revoke/);")

# Using regex for the corrupted className because of the tab character
import re
content = re.sub(r'<span className=\{\s*ext-xs font-bold px-2\.5 py-1 rounded-full \}>', r'<span className={	ext-xs font-bold px-2.5 py-1 rounded-full }>', content)

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
