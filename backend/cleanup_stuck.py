from apps.vms.models import Workspace, VirtualMachine

Workspace.objects.filter(
    status='active',
    vm__status='provisioning'
).delete()

print('Cleared stuck workspace(s)')
