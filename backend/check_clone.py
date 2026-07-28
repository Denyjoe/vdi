from apps.vms.services.proxmox_service import ProxmoxService
ps = ProxmoxService()
tasks = ps.proxmox.nodes(ps.node).tasks.get()
for task in tasks:
    if task.get('id') == '9020' and task.get('status') == 'running':
        print(f"Task {task.get('upid')} is still running")
