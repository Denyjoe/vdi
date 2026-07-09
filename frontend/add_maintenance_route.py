import sys

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'import MaintenancePage' not in content:
    content = content.replace(
        'import NotFoundPage from "./pages/shared/NotFoundPage";',
        'import NotFoundPage from "./pages/shared/NotFoundPage";\nimport MaintenancePage from "./pages/shared/MaintenancePage";'
    )
    
if '<Route path="/maintenance" element={<MaintenancePage />} />' not in content:
    content = content.replace(
        '<Route path="/forgot-password" element={<ForgotPasswordPage />} />',
        '<Route path="/forgot-password" element={<ForgotPasswordPage />} />\n          <Route path="/maintenance" element={<MaintenancePage />} />'
    )

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added MaintenancePage to App.jsx")
