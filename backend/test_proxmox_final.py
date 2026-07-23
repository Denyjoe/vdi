import os
import django
import time
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from apps.vms.models import Workspace, VirtualMachine, VMTemplate
from apps.vms.services.proxmox_service import ProxmoxService

user = User.objects.filter(is_superuser=True).first()
if not user:
    user = User.objects.first()

template = VMTemplate.objects.first()

ws_name = f'proxmox-delete-test-{random.randint(1000, 9999)}'
ws = Workspace.objects.create(
    name=ws_name,
    owner=user,
    vm_template=template,
    status='active'
)

ps = ProxmoxService()
clone_name = f'vm-{user.id}-{ws.id}'
print(f"Cloning template {template.proxmox_template_id} to create real Proxmox VM...")

new_vmid = ps.clone_template(template.proxmox_template_id, clone_name)
print(f"Created real Proxmox VM with ID: {new_vmid}")

time.sleep(10)  # Wait for any lingering clone locks to release

print(f"VM {new_vmid} is cloned. Now starting...")
for _ in range(5):
    try:
        ps.start_vm(new_vmid)
        break
    except Exception as e:
        print("Start failed, retrying...", e)
        time.sleep(5)

# Wait for it to be 'running'
while True:
    st = ps.proxmox.nodes(ps.node).qemu(new_vmid).status.current.get().get('status')
    if st == 'running':
        break
    time.sleep(2)

print(f"VM {new_vmid} is genuinely RUNNING.")

vm = VirtualMachine.objects.create(
    name=clone_name,
    owner=user,
    template=template,
    status='running',
    proxmox_vm_id=new_vmid
)
ws.vm = vm
ws.save()

# Simulate WorkspaceDeleteView logic using test client
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.vms.workspace_views import WorkspaceDeleteView

factory = APIRequestFactory()
request = factory.post(f'/api/workspaces/{ws.id}/')
force_authenticate(request, user=user)

view = WorkspaceDeleteView.as_view()
print(f"Initiating delete view for workspace {ws.id} (VM {new_vmid})...")
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
    if v.get('vmid') == new_vmid:
        found = True

if not found:
    print(f"Success: VM {new_vmid} is genuinely GONE from Proxmox!")
else:
    print(f"ERROR: VM {new_vmid} STILL EXISTS in Proxmox!")
