import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.services.proxmox_service import ProxmoxService
from apps.vms.models import VMTemplate, VirtualMachine

ps = ProxmoxService()
vms = ps.proxmox.nodes(ps.node).qemu.get()

print('=== ALL VMs IN PROXMOX ===')
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(f"VMID: {v.get('vmid')} | Name: {v.get('name')} | Status: {v.get('status')} | Template: {v.get('template', 0)} | Disk: {round(v.get('maxdisk', 0) / (1024**3), 1)}GB")

print('\n=== TEMPLATES REFERENCED BY APP ===')
for t in VMTemplate.objects.filter(is_real=True):
    print(f'{t.name} -> Proxmox ID: {t.proxmox_template_id}')

print('\n=== VMs REFERENCED BY APP ===')
for vm in VirtualMachine.objects.all():
    print(f"DB ID: {vm.id} -> Proxmox VMID: {getattr(vm, 'proxmox_vm_id', None)} | Status: {vm.status}")
