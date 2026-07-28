from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()

for vmid in [100, 101]:
    try:
        status = ps.proxmox.nodes(ps.node).qemu(vmid).status.current.get()
        if status.get('status') == 'running':
            ps.proxmox.nodes(ps.node).qemu(vmid).status.stop.post()
            time.sleep(5)
        ps.proxmox.nodes(ps.node).qemu(vmid).delete()
        print(f'VM {vmid} deleted')
    except Exception as e:
        print(f'VM {vmid} error: {str(e)}')

print()
print('=== FINAL VM LIST ===')
vms = ps.proxmox.nodes(ps.node).qemu.get()
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(v.get('vmid'), v.get('name'), v.get('status'))
