from apps.vms.services.proxmox_service import ProxmoxService
ps = ProxmoxService()
ps.delete_vm_completely(9020)
print('9020 removed')
