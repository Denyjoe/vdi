import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.models import VirtualMachine
from apps.vms.services.vm_orchestrator import VMOrchestrator

vm = VirtualMachine.objects.get(id=9)
print(f"Testing provision_real_vm for VM {vm.id}")

orchestrator = VMOrchestrator()
try:
    result = orchestrator.provision_real_vm(vm)
    print("Result:", result)
except Exception as e:
    import traceback
    traceback.print_exc()
