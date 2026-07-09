import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminTemplatesPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the message for delete ConfirmModal
content = content.replace(
    'message={Are you sure you want to delete ? This action cannot be undone.}',
    'message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}'
)

# Fix Price per hour interpolation
content = content.replace(
    "{t.price_per_hour > 0 ? `TZS /hr` : 'Free'}",
    "{t.price_per_hour > 0 ? `TZS ${t.price_per_hour.toLocaleString()}/hr` : 'Free'}"
)
# Wait, let's see what the actual content looks like for price_per_hour
content = content.replace(
    "TZS /hr",
    "TZS ${t.price_per_hour.toLocaleString()}/hr"
)

# Fix duplicate ID interpolation
content = content.replace(
    "Duplicate (ID: )",
    "Duplicate (ID: {t.proxmox_template_id})"
)
content = content.replace(
    "Linked (ID: )",
    "Linked (ID: {t.proxmox_template_id})"
)

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminTemplatesPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
