import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'AdminLiveSessionsPage' not in content:
    content = content.replace("import AdminSettingsPage from './pages/admin/AdminSettingsPage';", 
                              "import AdminSettingsPage from './pages/admin/AdminSettingsPage';\nimport AdminLiveSessionsPage from './pages/admin/AdminLiveSessionsPage';")

content = re.sub(r'<Route path="sessions" element=\{<SessionsPage />\} />', 
                 r'<Route path="sessions" element={<AdminLiveSessionsPage />} />', content)

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
