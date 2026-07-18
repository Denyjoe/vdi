import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.services.proxmox_service import ProxmoxService
ps = ProxmoxService()
vms = ps.proxmox.nodes(ps.node).qemu.get()

print('=== REMAINING VMs (after wait) ===')
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(f"VMID: {v.get('vmid')} | Name: {v.get('name')} | Status: {v.get('status')} | Template: {v.get('template', 0)}")

storage = ps.proxmox.nodes(ps.node).storage('local-lvm').status.get()
used_gb = round(storage['used'] / (1024**3), 1)
total_gb = round(storage['total'] / (1024**3), 1)
free_gb = round(total_gb - used_gb, 1)
print(f'\nStorage: {used_gb}GB used / {total_gb}GB total / {free_gb}GB free')
