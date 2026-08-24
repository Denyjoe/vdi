"""Delete orphan VMs 160, 998, 999 from Proxmox."""
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.services.proxmox_service import ProxmoxService

ORPHAN_VMIDS = [160, 998, 999]

svc = ProxmoxService()

for vmid in ORPHAN_VMIDS:
    print(f"\n--- Deleting VM {vmid} ---")
    try:
        svc.delete_vm_completely(vmid)
        print(f"  VM {vmid}: deleted successfully")
    except Exception as e:
        print(f"  VM {vmid}: error — {e}")

# Verify
print("\n=== Remaining Proxmox VMs ===")
for v in sorted(svc.proxmox.nodes(svc.node).qemu.get(), key=lambda x: int(x['vmid'])):
    print(f"  vmid={v['vmid']}  name={v.get('name','?')}  status={v.get('status','?')}")
