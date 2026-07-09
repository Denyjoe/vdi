import sys

with open('src/pages/admin/AdminSettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_save = """  const saveResourceLimits = async () => {
    setSavingSection('limits');
    try {
      await api.put('/admin/settings/config/', resourceLimits);
      toast.success('Resource limits saved');
    } catch (e) {
      toast.error('Failed to save limits');
    } finally {
      setSavingSection(null);
    }
  };"""

content = content.replace(
"""  const saveResourceLimits = async () => {
    setSavingSection('limits');
    await new Promise(r => setTimeout(r, 600));
    localStorage.setItem('clouddesk_resource_limits', JSON.stringify(resourceLimits));
    toast.success('Resource limits saved');
    setSavingSection(null);
  };""", new_save)

with open('src/pages/admin/AdminSettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed saveResourceLimits")
