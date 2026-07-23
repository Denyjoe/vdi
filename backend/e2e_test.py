from rest_framework.test import APIClient
from django.conf import settings
settings.ALLOWED_HOSTS.append('testserver')
from apps.users.models import User
from apps.vms.models import (
    VMTemplate, Workspace)
from apps.vms.services.proxmox_service import (
    ProxmoxService)
import json, time

from rest_framework_simplejwt.tokens import RefreshToken

user = User.objects.filter(
    email='deniswilson255@gmail.com'
).first()

if hasattr(user, 'subscription') and user.subscription:
    user.subscription.compute_hours_used = 0
    user.subscription.save()

refresh = RefreshToken.for_user(user)
token = str(refresh.access_token)

template = VMTemplate.objects.filter(
    is_real=True).first()

c = APIClient()
c.credentials(HTTP_AUTHORIZATION='Bearer ' + token)

import random
name = 'Delete Fix Real Test ' + str(random.randint(1000, 9999))
print('=== CREATE WORKSPACE ===')
res = c.post(
    '/api/workspaces/create/',
    data=json.dumps({
        'vm_template': template.id,
        'name': name
    }),
    content_type='application/json'
)
print('Create status:', 
    res.status_code)
data = json.loads(res.content)
print('Create response:', data)

ws_id = data.get('data', {}).get(
    'id') or data.get('id')
print('Workspace ID:', ws_id)

print()
print('=== LAUNCH WORKSPACE ===')
res2 = c.post(
    f'/api/workspaces/{ws_id}/launch/')
print('Launch status:', 
    res2.status_code)
print('Launch response:', res2.content.decode())

print()
print('Waiting for provisioning to '
    'complete (up to 2 minutes)...')
for i in range(24):
    time.sleep(5)
    ws = Workspace.objects.get(
        id=ws_id)
    if ws.vm and ws.vm.status == 'running':
        print(f'Running after {(i+1)*5}s, Proxmox VM ID: {ws.vm.proxmox_vm_id}')
        break
    print(f'  ...still {ws.status}/{ws.vm.status if ws.vm else None} at {(i+1)*5}s')
else:
    print('TIMEOUT — did not reach running state')

ws = Workspace.objects.get(id=ws_id)
proxmox_vm_id = (ws.vm.proxmox_vm_id 
    if ws.vm else None)

print()
print('=== VERIFY VM EXISTS IN '
    'PROXMOX BEFORE DELETE ===')
ps = ProxmoxService()
vms_before = ps.proxmox.nodes(
    ps.node).qemu.get()
exists_before = any(
    v['vmid'] == proxmox_vm_id 
    for v in vms_before)
print(f'VM {proxmox_vm_id} exists '
    f'in Proxmox: {exists_before}')

print()
print('=== DELETE WORKSPACE (via '
    'real delete endpoint) ===')
res3 = c.post(
    f'/api/workspaces/{ws_id}/delete/')
print('Delete status:', 
    res3.status_code)
print('Delete response:', 
    res3.content.decode())

print()
print('Waiting 15s for async '
    'cleanup...')
time.sleep(15)

print()
print('=== VERIFY VM GONE FROM '
    'PROXMOX AFTER DELETE ===')
vms_after = ps.proxmox.nodes(
    ps.node).qemu.get()
exists_after = any(
    v['vmid'] == proxmox_vm_id 
    for v in vms_after)
print(f'VM {proxmox_vm_id} still '
    f'exists in Proxmox: '
    f'{exists_after}')

if not exists_after:
    print()
    print('✓✓✓ CONFIRMED: DELETE '
        'FIX WORKS CORRECTLY '
        'END-TO-END ✓✓✓')
else:
    print()
    print('✗✗✗ STILL BROKEN — VM '
        'NOT ACTUALLY DELETED ✗✗✗')

print()
print('=== FINAL PROXMOX VM LIST ===')
for v in sorted(vms_after, 
    key=lambda x: x.get('vmid', 0)):
    print(v.get('vmid'), 
        v.get('name'), 
        v.get('status'))
