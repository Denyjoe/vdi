import sys

with open('src/pages/admin/AdminSettingsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_fetch = """  const fetchConfig = async () => {
    try {
      const res = await api.get('/admin/config/');
      if (res.data.success && res.data.data) {
        setPlatformConfig(prev => ({ ...prev, ...res.data.data }));
        setResourceLimits(prev => ({
          ...prev,
          max_vms_per_user: res.data.data.max_vms_per_user !== undefined ? res.data.data.max_vms_per_user : prev.max_vms_per_user,
          max_concurrent_vms: res.data.data.max_concurrent_vms !== undefined ? res.data.data.max_concurrent_vms : prev.max_concurrent_vms,
          vm_provisioning_timeout: res.data.data.vm_provisioning_timeout !== undefined ? res.data.data.vm_provisioning_timeout : prev.vm_provisioning_timeout,
          idle_timeout_mins: res.data.data.idle_timeout_mins !== undefined ? res.data.data.idle_timeout_mins : prev.idle_timeout_mins,
          auto_shutdown_idle: res.data.data.auto_shutdown_idle !== undefined ? res.data.data.auto_shutdown_idle === 'true' || res.data.data.auto_shutdown_idle === true : prev.auto_shutdown_idle
        }));
      }
    } catch (err) {
      console.error('Failed to fetch config');
    }
  };"""

content = content.replace(
"""  const fetchConfig = async () => {
    try {
      const res = await api.get('/admin/config/');
      if (res.data.success && res.data.data) {
        setPlatformConfig(prev => ({ ...prev, ...res.data.data }));
      }
    } catch (err) {
      console.error('Failed to fetch platform config');
    }
  };""", new_fetch)

with open('src/pages/admin/AdminSettingsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed fetchConfig")
