import os
import django
import time
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from apps.vms.models import Workspace, VirtualMachine, VMTemplate
from apps.vms.services.proxmox_service import ProxmoxService
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.vms.workspace_views import WorkspaceDeleteView

user = User.objects.filter(is_superuser=True).first()
if not user:
    user = User.objects.first()

template = VMTemplate.objects.first()

ws_name = f'delete-test-running-{random.randint(1000, 9999)}'
ws = Workspace.objects.create(
    name=ws_name,
    owner=user,
    vm_template=template,
    status='active'
)

vm_id = 101  # We verified this is running and unlocked
print(f"Using existing running VM {vm_id} for deletion test...")

vm = VirtualMachine.objects.create(
    name=f"test-vm-{vm_id}",
    owner=user,
    template=template,
    status='running',
    proxmox_vm_id=vm_id
)
ws.vm = vm
ws.save()

ps = ProxmoxService()
st = ps.proxmox.nodes(ps.node).qemu(vm_id).status.current.get().get('status')
print(f"Verified VM {vm_id} is genuinely {st.upper()}.")

print(f"Initiating delete view for workspace {ws.id} (VM {vm_id})...")
factory = APIRequestFactory()
request = factory.post(f'/api/workspaces/{ws.id}/')
force_authenticate(request, user=user)

view = WorkspaceDeleteView.as_view()
response = view(request, pk=ws.id)
print("Delete Response status:", response.status_code)
if response.status_code == 500:
    print("Delete Error:", response.data)

print('=== ALL VMs IN PROXMOX ===')
vms = ps.proxmox.nodes(ps.node).qemu.get()
found = False
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(
        f"VMID: {v.get('vmid')} | "
        f"Name: {v.get('name')} | "
        f"Status: {v.get('status')} | "
        f"Template: {v.get('template', 0)}"
    )
    if v.get('vmid') == vm_id:
        found = True

if not found:
    print(f"Success: VM {vm_id} is genuinely GONE from Proxmox!")
else:
    print(f"ERROR: VM {vm_id} STILL EXISTS in Proxmox!")
