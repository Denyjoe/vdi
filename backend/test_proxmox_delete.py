import os
import django
import time
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from apps.vms.models import Workspace, VirtualMachine, VMTemplate
from apps.vms.services.proxmox_service import ProxmoxService
from apps.vms.services.guacamole_service import GuacamoleService

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

# Mock the VM creation by explicitly cloning the template to get a real Proxmox VM
ps = ProxmoxService()
clone_name = f'vm-{user.id}-{ws.id}'
print(f"Cloning template {template.proxmox_template_id} to create real Proxmox VM...")
new_vmid = ps.clone_template(template.proxmox_template_id, clone_name)
print(f"Created real Proxmox VM with ID: {new_vmid}")

# Start it to simulate a running workspace
ps.start_vm(new_vmid)

vm = VirtualMachine.objects.create(
    name=clone_name,
    owner=user,
    template=template,
    status='running',
    proxmox_vm_id=new_vmid
)
ws.vm = vm
ws.save()

# Confirm VM exists in Proxmox
status = ps.proxmox.nodes(ps.node).qemu(new_vmid).status.current.get()
print(f"Confirmed VM {new_vmid} exists in Proxmox with status: {status.get('status')}")

# Simulate WorkspaceDeleteView logic using test client
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.vms.workspace_views import WorkspaceDeleteView

factory = APIRequestFactory()
request = factory.post(f'/api/workspaces/{ws.id}/')
force_authenticate(request, user=user)

view = WorkspaceDeleteView.as_view()
response = view(request, pk=ws.id)
print("Delete Response status:", response.status_code)
if response.status_code == 500:
    print("Delete Error:", response.data)

# Confirm VM is GONE from Proxmox
try:
    status = ps.proxmox.nodes(ps.node).qemu(new_vmid).status.current.get()
    print(f"ERROR: VM {new_vmid} STILL EXISTS in Proxmox with status: {status.get('status')}!")
except Exception as e:
    if "does not exist" in str(e).lower() or "500" in str(e) or "not found" in str(e).lower():
        print(f"Success: VM {new_vmid} is genuinely GONE from Proxmox!")
    else:
        print(f"Checking VM {new_vmid} failed with unexpected error: {str(e)}")
