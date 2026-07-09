import re

with open('src/pages/admin/VMPoolPage.jsx', 'r') as f:
    text = f.read()

# Fix template literals broken by powershell
text = re.sub(r'api\.delete\(/vms/admin/pool/\\/\)', 'api.delete(/vms/admin/pool//)', text)
text = re.sub(r'api\.put\(/vms/admin/templates/\\/pool-config/.*', 'api.put(/vms/admin/templates//pool-config/, { [field]: value })', text)
text = re.sub(r'api\.post\(/vms/admin/templates/\\/test-link/.*', 'api.post(/vms/admin/templates//test-link/, { proxmox_vm_id: vmIdInput })', text)
text = re.sub(r'api\.post\(/vms/admin/templates/\\/preview/.*', 'api.post(/vms/admin/templates//preview/, { proxmox_vm_id: vmIdInput })', text)
text = re.sub(r'api\.put\(/vms/admin/templates/\\/link/.*', "api.put(/vms/admin/templates//link/, { proxmox_template_id: vmIdInput })", text)
text = re.sub(r'api\.post\(/vms/admin/templates/\\/link/.*', "api.post(/vms/admin/templates//link/, { proxmox_template_id: null })", text)

text = re.sub(r'return s ago;', 'return ${diff}s ago;', text)
text = re.sub(r'return Math.floor\(diff/60\) \+ m ago;', 'return ${Math.floor(diff/60)}m ago;', text)
text = re.sub(r'return Math.floor\(diff/3600\) \+ h ago;', 'return ${Math.floor(diff/3600)}h ago;', text)
text = re.sub(r"Clone  \+ createForm.count \+  VM\(s\)", "Clone  VM(s)", text)
text = re.sub(r"Clone  VM\(s\)", "Clone  VM(s)", text)

with open('src/pages/admin/VMPoolPage.jsx', 'w') as f:
    f.write(text)
