"""
Test script for admin workspace delete with Proxmox cleanup.
Creates a workspace, launches it, waits for provisioning,
then deletes it via the admin endpoint and verifies Proxmox cleanup.
"""
from rest_framework.test import APIClient
from apps.users.models import User
from apps.vms.models import VMTemplate, Workspace, VirtualMachine
from apps.vms.services.proxmox_service import ProxmoxService
import json, time

# Setup
user = User.objects.filter(email='deniswilson255@gmail.com').first()
admin = User.objects.filter(is_staff=True).first() or user
template = VMTemplate.objects.filter(is_real=True).first()
ps = ProxmoxService()

# Create workspace
c = APIClient(SERVER_NAME='localhost', HTTP_HOST='localhost')
c.force_authenticate(user=user)
workspace_name = f'Admin Delete Test {int(time.time())}'
res = c.post('/api/workspaces/create/',
    data=json.dumps({'vm_template': template.id, 'name': workspace_name}),
    content_type='application/json')
data = json.loads(res.content)
ws_id = data.get('data', {}).get('id')
print(f'Created workspace {ws_id}')

# Launch it
res2 = c.post(f'/api/workspaces/{ws_id}/launch/')
print(f'Launch response: {res2.status_code}')

# Wait for provisioning (poll until VM has a proxmox_vm_id)
print('Waiting for provisioning...')
proxmox_vm_id = None
for i in range(20):
    time.sleep(10)
    ws = Workspace.objects.get(id=ws_id)
    if ws.vm and ws.vm.proxmox_vm_id:
        proxmox_vm_id = ws.vm.proxmox_vm_id
        print(f'  VM provisioned: proxmox_id={proxmox_vm_id}, status={ws.vm.status}')
        break
    print(f'  [{(i+1)*10}s] vm_status={ws.vm.status if ws.vm else "no vm"}')

if not proxmox_vm_id:
    print('ERROR: VM never got a proxmox_vm_id')
    exit(1)

# Verify VM exists in Proxmox BEFORE delete
print()
print('=== BEFORE ADMIN DELETE ===')
vms_before = [v.get('vmid') for v in ps.proxmox.nodes(ps.node).qemu.get()]
print(f'Proxmox VMs: {sorted(vms_before)}')
assert proxmox_vm_id in vms_before, f'VM {proxmox_vm_id} not found in Proxmox!'
print(f'VM {proxmox_vm_id} confirmed in Proxmox')

# Delete via ADMIN endpoint
print()
print('=== ADMIN DELETE ===')
admin_client = APIClient(SERVER_NAME='localhost', HTTP_HOST='localhost')
admin_client.force_authenticate(user=admin)
res3 = admin_client.delete(f'/api/admin/workspaces/{ws_id}/')
print(f'Admin delete response: {res3.status_code} {res3.content.decode()[:200]}')

# Wait a moment for async cleanup
time.sleep(3)

# Verify VM is GONE from Proxmox AFTER delete
print()
print('=== AFTER ADMIN DELETE ===')
vms_after = [v.get('vmid') for v in ps.proxmox.nodes(ps.node).qemu.get()]
print(f'Proxmox VMs: {sorted(vms_after)}')
if proxmox_vm_id in vms_after:
    print(f'FAIL: VM {proxmox_vm_id} STILL in Proxmox after admin delete!')
else:
    print(f'SUCCESS: VM {proxmox_vm_id} confirmed REMOVED from Proxmox after admin delete')

# Verify DB is clean
ws_exists = Workspace.objects.filter(id=ws_id).exists()
print(f'Workspace in DB: {ws_exists} (should be False)')
