with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/VMPoolPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('linkModalTemplate')
if start != -1:
    print('Found linkModalTemplate')
else:
    print('Not found linkModalTemplate')
