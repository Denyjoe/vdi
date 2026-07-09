import sys

with open('src/pages/shared/MaintenancePage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'import { Settings, Tool } from \\'lucide-react\\';',
    'import { Settings } from \\'lucide-react\\';'
)
content = content.replace(
    'import { useThemeStore } from \\'../../store/uiStore\\';',
    ''
)
content = content.replace(
    'const { theme } = useThemeStore();',
    'const theme = \\'dark\\';'
)

with open('src/pages/shared/MaintenancePage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed MaintenancePage")
