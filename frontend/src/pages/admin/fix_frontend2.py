import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminAnalyticsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("name: `` ``,", "name: ${u.first_name} ,")
content = content.replace("name: ` `,", "name: ${u.first_name} ,")
content = content.replace("<Cell key={cell-}", "<Cell key={cell-}")

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminAnalyticsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
