from apps.vms.models import Workspace, VirtualMachine
Workspace.objects.all().delete()
VirtualMachine.objects.all().delete()
print('Database cleared for clean test')
