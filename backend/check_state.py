"""Confirm VM 105 gone, VM 106 is a template, and list all Proxmox VMs."""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '.')
django.setup()

from apps.vms.services.proxmox_service import ProxmoxService

ps = ProxmoxService()

# Check VM 105
try:
    ps.proxmox.nodes(ps.node).qemu(105).status.current.get()
    print('VM 105: STILL EXISTS')
except Exception:
    print('VM 105: Confirmed gone')

# Check VM 106
try:
    status = ps.proxmox.nodes(ps.node).qemu(106).status.current.get()
    print('VM 106 status:', status.get('status'))
    print('VM 106 template:', status.get('template'))
    print('VM 106 lock:', status.get('lock', 'none'))
except Exception as e:
    print('VM 106 error:', str(e))

# List all VMs
vms = ps.proxmox.nodes(ps.node).qemu.get()
print()
print('All Proxmox VMs:')
for vm in sorted(vms, key=lambda x: x.get('vmid', 0)):
    vmid = vm['vmid']
    name = vm.get('name', '?')
    st = vm.get('status')
    tmpl = vm.get('template', 0)
    print(f'  vmid={vmid} name={name} status={st} template={tmpl}')
