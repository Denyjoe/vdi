with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminTemplatesPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
    
# Let's verify if openEditModal is present and how it works
if 'openEditForm' in content:
    print('Found openEditForm')
else:
    print('openEditForm missing')

if 'handleRefresh' in content:
    print('Found handleRefresh')
else:
    print('handleRefresh missing')
    
