import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/sessions/admin_views.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace participants_data.append to include user_id
old_append = """participants_data.append({
                    'id': p.id,"""
new_append = """participants_data.append({
                    'id': p.id,
                    'user_id': p.user.id if p.user else None,"""

content = content.replace(old_append, new_append)

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/sessions/admin_views.py', 'w', encoding='utf-8') as f:
    f.write(content)
