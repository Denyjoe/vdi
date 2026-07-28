from apps.vms.services.proxmox_service import ProxmoxService
from apps.vms.models import Workspace, VirtualMachine

ps = ProxmoxService()
try:
    ps.delete_vm_completely(9023)
    print('VM 9023 removed from Proxmox')
except Exception as e:
    print('Cleanup note:', str(e))

Workspace.objects.all().delete()
VirtualMachine.objects.all().delete()
print('Database records cleared')
