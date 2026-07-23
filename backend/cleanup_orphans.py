import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()
orphan_ids = [100, 102, 103]

for vmid in orphan_ids:
    try:
        status = ps.proxmox.nodes(ps.node).qemu(vmid).status.current.get()
        if status.get('status') == 'running':
            ps.proxmox.nodes(ps.node).qemu(vmid).status.stop.post()
            for i in range(15):
                time.sleep(2)
                curr_status = ps.proxmox.nodes(ps.node).qemu(vmid).status.current.get()
                if curr_status.get('status') == 'stopped':
                    break
        ps.proxmox.nodes(ps.node).qemu(vmid).delete()
        print(f'VM {vmid} deleted')
    except Exception as e:
        print(f'VM {vmid} error: {str(e)}')
