with open('src/pages/admin/VMPoolPage.jsx', 'r') as f:
    code = f.read()

import re
code = re.sub(r'api\.delete\(/vms/admin/pool/\s*\+\s*entryId\s*\+\s*/\)', 'api.delete(/vms/admin/pool//)', code)
code = re.sub(r'api\.put\(/vms/admin/templates/\s*\+\s*templateId\s*\+\s*/pool-config/.*', 'api.put(/vms/admin/templates//pool-config/, { [field]: value })', code)
code = re.sub(r'api\.post\(/vms/admin/templates/\s*\+\s*linkModalTemplate\.id\s*\+\s*/test-link/.*', 'api.post(/vms/admin/templates//test-link/, { proxmox_vm_id: vmIdInput })', code)
code = re.sub(r'api\.post\(/vms/admin/templates/\s*\+\s*linkModalTemplate\.id\s*\+\s*/preview/.*', 'api.post(/vms/admin/templates//preview/, { proxmox_vm_id: vmIdInput })', code)
code = re.sub(r'api\.put\(/vms/admin/templates/\s*\+\s*linkModalTemplate\.id\s*\+\s*/link/.*', "api.put(/vms/admin/templates//link/, { proxmox_template_id: vmIdInput })", code)
code = re.sub(r'api\.post\(/vms/admin/templates/\s*\+\s*templateId\s*\+\s*/link/.*', "api.post(/vms/admin/templates//link/, { proxmox_template_id: null })", code)

with open('src/pages/admin/VMPoolPage.jsx', 'w') as f:
    f.write(code)
