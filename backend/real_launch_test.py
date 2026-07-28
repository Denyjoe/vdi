from rest_framework.test import APIClient
from apps.users.models import User
from apps.vms.models import VMTemplate, Workspace
import json, time

user = User.objects.filter(email='deniswilson255@gmail.com').first()
template = VMTemplate.objects.filter(is_real=True).first()

c = APIClient(SERVER_NAME='localhost', HTTP_HOST='localhost')
c.force_authenticate(user=user)

import time
workspace_name = f'Real Test {int(time.time())}'
print('=== CREATE ===')
res = c.post('/api/workspaces/create/',
    data=json.dumps({'vm_template': template.id, 'name': workspace_name}),
    content_type='application/json')
print(res.status_code, res.content.decode()[:300])
data = json.loads(res.content)
ws_id = data.get('data', {}).get('id') or data.get('id')
print('Workspace ID:', ws_id)

print()
print('=== LAUNCH ===')
res2 = c.post(f'/api/workspaces/{ws_id}/launch/')
print(res2.status_code, res2.content.decode()[:300])

print()
print('=== POLLING (up to 10 min, every 15s) ===')
for i in range(40):
    time.sleep(15)
    ws = Workspace.objects.get(id=ws_id)
    vm_status = ws.vm.status if ws.vm else 'no-vm'
    vm_notes = ws.vm.notes if ws.vm else ''
    proxmox_id = getattr(ws.vm, 'proxmox_vm_id', None) if ws.vm else None
    print(f'[{(i+1)*15}s] ws={ws.status} vm={vm_status} proxmox_id={proxmox_id} notes={vm_notes}')
    if vm_status == 'running':
        print('SUCCESS - reached running state')
        break
    if vm_status == 'error':
        print('FAILED - vm status is error')
        break

print()
print('=== FINAL STATE ===')
ws = Workspace.objects.get(id=ws_id)
print('Workspace status:', ws.status)
if ws.vm:
    print('VM status:', ws.vm.status)
    print('VM IP:', ws.vm.ip_address)
    print('VM notes:', ws.vm.notes)
    print('Guacamole conn:', ws.vm.guacamole_connection_id)
