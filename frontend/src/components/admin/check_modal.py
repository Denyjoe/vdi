with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/VMPoolPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
    if 'TemplateLinkModal' in content:
        print('Uses TemplateLinkModal')
    else:
        print('Does not use TemplateLinkModal')
