import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.services.proxmox_service import ProxmoxService
ps = ProxmoxService()

print('=== ALL VMs IN PROXMOX ===')
vms = ps.proxmox.nodes(ps.node).qemu.get()
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(
        f"VMID: {v.get('vmid')} | "
        f"Name: {v.get('name')} | "
        f"Status: {v.get('status')} | "
        f"Template: {v.get('template', 0)}"
    )
