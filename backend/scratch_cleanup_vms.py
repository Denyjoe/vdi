import os
import django
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.services.proxmox_service import ProxmoxService

ps = ProxmoxService()
orphan_vmids = [100, 101, 102, 103, 104, 105, 107, 108]
protected_vmids = [106, 200, 9000, 9001]

print("=== STARTING ORPHAN DELETION ===")
for vmid in orphan_vmids:
    if vmid in protected_vmids:
        print(f"  CRITICAL ERROR: Attempted to delete protected VM {vmid}. Skipping.")
        continue
        
    try:
        status = ps.proxmox.nodes(ps.node).qemu(vmid).status.current.get()
        current_status = status.get('status')
        print(f'VM {vmid}: current status = {current_status}')
        
        if current_status == 'running':
            print(f'  Stopping VM {vmid}...')
            ps.proxmox.nodes(ps.node).qemu(vmid).status.stop.post()
            time.sleep(5)
        
        print(f'  Deleting VM {vmid}...')
        ps.proxmox.nodes(ps.node).qemu(vmid).delete()
        print(f'  VM {vmid} deleted successfully')
    except Exception as e:
        print(f'  VM {vmid} error: {str(e)}')
    print()

print('=== REMAINING VMs ===')
vms = ps.proxmox.nodes(ps.node).qemu.get()
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(f"VMID: {v.get('vmid')} | Name: {v.get('name')} | Status: {v.get('status')} | Template: {v.get('template', 0)}")

print('\n=== STORAGE ===')
try:
    storage = ps.proxmox.nodes(ps.node).storage('local-lvm').status.get()
    used_gb = round(storage['used'] / (1024**3), 1)
    total_gb = round(storage['total'] / (1024**3), 1)
    free_gb = round(total_gb - used_gb, 1)
    print(f'Storage: {used_gb}GB used / {total_gb}GB total / {free_gb}GB free')
except Exception as e:
    print(f"Failed to get storage stats: {e}")
