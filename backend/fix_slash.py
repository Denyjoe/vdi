with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/admin_views.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(r"or r'\' in filename:", "or '\\\\' in filename:")

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/users/admin_views.py', 'w', encoding='utf-8') as f:
    f.write(content)
