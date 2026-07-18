from apps.vms.models import VMTemplate, VirtualMachine

print('=== TEMPLATES REFERENCED BY APP ===')
for t in VMTemplate.objects.filter(is_real=True):
    print(f'{t.name} -> Proxmox ID: {t.proxmox_template_id}')

print()
print('=== VMs REFERENCED BY APP ===')
for vm in VirtualMachine.objects.all():
    print(f'DB ID: {vm.id} -> Proxmox VMID: {getattr(vm, "proxmox_vm_id", None)} | Status: {vm.status}')
