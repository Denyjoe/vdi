"""Quick diagnostic: compare Proxmox VMs with DB workspace/pool records."""
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.services.proxmox_service import ProxmoxService
from apps.vms.models import Workspace, VMPoolEntry, VMTemplate, VirtualMachine

svc = ProxmoxService()

# 1) What Proxmox reports
vms = svc.proxmox.nodes(svc.node).qemu.get()
print(f"\n=== Proxmox VMs ({len(vms)}) ===")
for v in sorted(vms, key=lambda x: int(x['vmid'])):
    print(f"  vmid={v['vmid']}  name={v.get('name','?')}  status={v.get('status','?')}")

# 2) DB Workspaces
ws_all = Workspace.objects.all()
print(f"\n=== DB Workspaces ({ws_all.count()}) ===")
for w in ws_all:
    print(f"  id={w.id}  vmid={w.proxmox_vmid}  user={w.user.email}  status={w.status}")

# 3) DB VirtualMachines
vms_db = VirtualMachine.objects.all()
print(f"\n=== DB VirtualMachines ({vms_db.count()}) ===")
for vm in vms_db:
    uid = vm.owner.email if vm.owner else 'N/A'
    print(f"  id={vm.id}  vmid={vm.proxmox_vm_id}  status={vm.status}  owner={uid}")

# 4) Pool entries
pool = VMPoolEntry.objects.all()
print(f"\n=== Pool Entries ({pool.count()}) ===")
for p in pool:
    tname = p.template.name if p.template else '?'
    print(f"  id={p.id}  vmid={p.proxmox_vmid}  status={p.status}  template={tname}")

# 5) Templates
templates = VMTemplate.objects.all()
print(f"\n=== Templates ({templates.count()}) ===")
for t in templates:
    print(f"  id={t.id}  proxmox_id={t.proxmox_template_id}  name={t.name}  is_real={t.is_real}")

# 6) Users
from apps.users.models import User
users = User.objects.all()
print(f"\n=== Users ({users.count()}) ===")
for u in users:
    print(f"  id={u.id}  email={u.email}  role={u.role}")
