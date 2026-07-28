from apps.vms.models import Workspace
ws = Workspace.objects.get(id=37)
print('Status:', ws.status)
if ws.vm:
    print('VM status:', ws.vm.status)
    print('VM IP:', ws.vm.ip_address)
    print('Guacamole conn ID:', ws.vm.guacamole_connection_id)
    print('Proxmox VM ID:', getattr(ws.vm, 'proxmox_vm_id', None))
