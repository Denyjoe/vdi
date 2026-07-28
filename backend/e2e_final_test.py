from rest_framework.test import APIClient
from apps.users.models import User
from apps.vms.models import VMTemplate, Workspace
import time

user = User.objects.filter(email='deniswilson255@gmail.com').first()
template = VMTemplate.objects.get(name='Ubuntu Desktop')

c = APIClient()
c.force_authenticate(user=user)

res = c.post('/api/workspaces/create/',
    {'vm_template': template.id, 'name': 'Ubuntu 9022 Final'}, format='json')
data = res.json()
ws_id = data.get('data', {}).get('id') or data.get('id')
print('Workspace:', ws_id)

c.post(f'/api/workspaces/{ws_id}/launch/')

for i in range(24):
    time.sleep(5)
    ws = Workspace.objects.get(id=ws_id)
    vm_status = ws.vm.status if ws.vm else 'no-vm'
    print(f'[{(i+1)*5}s] {vm_status}')
    if vm_status == 'running':
        print('SUCCESS')
        print('IP:', ws.vm.ip_address)
        print('Guac conn:', ws.vm.guacamole_connection_id)
        break
    if vm_status == 'error':
        print('FAILED:', ws.vm.notes)
        break
