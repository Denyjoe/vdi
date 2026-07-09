with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminAnalyticsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Target strictly the exact strings to replace.
old_url = "api.get('/vms/admin/templates/'),"
new_url = "api.get('/users/admin/analytics/vm-usage/'),"

old_map = '''        if (templatesRes.status === 'fulfilled' && templatesRes.value.data.success) {
          const templates = templatesRes.value.data.data.map(t => ({
            name: t.name,
            count: t.pool_count || 0
          }));
          setVmTemplates(templates);
        }'''

new_map = '''        if (templatesRes.status === 'fulfilled' && templatesRes.value.data.success) {
          const templates = templatesRes.value.data.data.by_template.map(t => ({
            name: t.template_name,
            count: t.vm_count || 0
          }));
          setVmTemplates(templates);
        }'''

if old_url in content:
    content = content.replace(old_url, new_url)
    print("URL Replaced")
else:
    print("URL NOT FOUND")

if old_map in content:
    content = content.replace(old_map, new_map)
    print("Mapping Replaced")
else:
    print("MAPPING NOT FOUND")

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminAnalyticsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
