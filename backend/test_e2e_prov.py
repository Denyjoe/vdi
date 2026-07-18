"""
Direct E2E provisioning test.
Creates workspace/VM records then calls provision_real_vm synchronously,
printing live status at each stage.
"""

import os
import django
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.models import VirtualMachine, Workspace
from apps.vms.services.vm_orchestrator import VMOrchestrator

vm = VirtualMachine.objects.get(id=11)
print(f"[START] Testing provision_real_vm for VM {vm.id} (template proxmox_id={vm.template.proxmox_template_id})")
print(f"        Owner: {vm.owner.email}")
print(f"        Template: {vm.template.name}")
print()

orchestrator = VMOrchestrator()
t0 = time.time()

try:
    result = orchestrator.provision_real_vm(vm)
    elapsed = time.time() - t0
    print(f"\n[DONE] Elapsed: {elapsed:.0f}s")
    print(f"Result: {result}")

    vm.refresh_from_db()
    print(f"\n[DB STATE]")
    print(f"  VM status:     {vm.status}")
    print(f"  VM IP:         {vm.ip_address}")
    print(f"  Proxmox VM ID: {vm.proxmox_vm_id}")
    print(f"  Notes:         {vm.notes}")

    ws = Workspace.objects.get(id=11)
    ws.refresh_from_db()
    print(f"  Workspace:     {ws.status}")

except Exception as e:
    import traceback
    print(f"\n[EXCEPTION] after {time.time()-t0:.0f}s")
    traceback.print_exc()
