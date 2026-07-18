import os
import django
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.models import VirtualMachine, Workspace, VMTemplate
from apps.vms.services.vm_orchestrator import VMOrchestrator
from django.contrib.auth import get_user_model

User = get_user_model()
u = User.objects.get(email='deniswilson255@gmail.com')
t = VMTemplate.objects.filter(is_real=True, proxmox_template_id=106).first()

if not t:
    print("Template pointing to 106 not found.")
    exit(1)

# Create VM
vm = VirtualMachine.objects.create(
    name=f"test-vm-{int(time.time())}",
    owner=u,
    template=t,
    status='provisioning'
)

# Create Workspace
ws = Workspace.objects.create(
    name=f"Test Workspace {vm.id}",
    owner=u,
    vm_template=t,
    vm=vm,
    status='starting'
)

print(f"[START] Provisioning VM {vm.id} for Workspace {ws.id}")
orchestrator = VMOrchestrator()
t0 = time.time()

try:
    result = orchestrator.provision_real_vm(vm)
    elapsed = time.time() - t0
    print(f"\n[DONE] Elapsed: {elapsed:.0f}s")
    
    vm.refresh_from_db()
    ws.refresh_from_db()
    
    # Update status
    ws.status = 'running'
    ws.save()
    
    print(f"[DB STATE]")
    print(f"  VM status:     {vm.status}")
    print(f"  VM IP:         {vm.ip_address}")
    print(f"  Proxmox VM ID: {vm.proxmox_vm_id}")
    print(f"  Workspace:     {ws.status}")
    print(f"  Guacamole Conn:{vm.guacamole_connection_id}")
except Exception as e:
    import traceback
    print(f"\n[EXCEPTION] after {time.time()-t0:.0f}s")
    traceback.print_exc()
