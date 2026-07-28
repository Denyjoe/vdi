from apps.vms.models import Workspace
from apps.vms.services.proxmox_service import ProxmoxService

ps = ProxmoxService()
for ws in Workspace.objects.all():
    print('Deleting workspace:', ws.name)
    if hasattr(ws, 'vm') and ws.vm and ws.vm.proxmox_vm_id:
        try:
            ps.delete_vm_completely(ws.vm.proxmox_vm_id)
        except Exception as e:
            print('Error deleting vm from proxmox:', str(e))
    ws.delete()
print('All clean')
