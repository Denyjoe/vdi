with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/VMPoolPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
matches = re.findall(r'const handleTestConnection[\s\S]*?const handleConfirmLink[\s\S]*?\}', content)
if matches:
    print(matches[0][:500])
else:
    print('Not found')
