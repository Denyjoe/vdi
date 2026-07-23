from apps.vms.services.proxmox_service import (
    ProxmoxService)
import time

ps = ProxmoxService()

for vmid in [102, 103]:
    try:
        # Try to check/clear lock via 
        # config first
        try:
            ps.proxmox.nodes(
                ps.node).qemu(
                vmid).config.post(
                delete='lock')
            print(f'VM {vmid}: '
                f'lock cleared via '
                f'config')
        except Exception as e:
            print(f'VM {vmid}: '
                f'config unlock '
                f'failed: {str(e)}')
        
        time.sleep(2)
        
        # Try delete with skiplock 
        # parameter
        try:
            result = ps.proxmox.nodes(
                ps.node).qemu(
                vmid).delete(
                skiplock=1, purge=1)
            print(f'VM {vmid}: '
                f'delete result: '
                f'{result}')
        except Exception as e:
            print(f'VM {vmid}: '
                f'delete failed: '
                f'{str(e)}')
    except Exception as e:
        print(f'VM {vmid}: overall '
            f'error: {str(e)}')

print()
print('=== FINAL VM LIST ===')
vms = ps.proxmox.nodes(
    ps.node).qemu.get()
for v in sorted(vms, 
    key=lambda x: x.get('vmid', 0)):
    print(v.get('vmid'), 
        v.get('name'), 
        v.get('status'))
