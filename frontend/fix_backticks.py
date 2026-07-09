with open('src/pages/admin/AdminWorkspacesPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('await api.get(/admin/workspaces/? + params.toString());', 
                          "await api.get('/admin/workspaces/?' + params.toString());")
content = content.replace('await api.post(/admin/workspaces/ + id + /force-stop/);',
                          "await api.post('/admin/workspaces/' + id + '/force-stop/');")
content = content.replace('await api.delete(/admin/workspaces/ + id + /);',
                          "await api.delete('/admin/workspaces/' + id + '/');")

with open('src/pages/admin/AdminWorkspacesPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Replaced")
