import sys

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'import AdminWorkspacesPage' not in content:
    content = content.replace(
        'import AdminSettingsPage from "./pages/admin/AdminSettingsPage";',
        'import AdminSettingsPage from "./pages/admin/AdminSettingsPage";\nimport AdminWorkspacesPage from "./pages/admin/AdminWorkspacesPage";'
    )
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Import added")
else:
    print("Import already exists")
