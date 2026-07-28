from rest_framework.test import APIClient
from apps.users.models import User
import json

host = User.objects.filter(email='deniswilson255@gmail.com').first()

c = APIClient()
c.force_authenticate(user=host)
res = c.post('/api/sessions/live/22/end/')
print('End status:', res.status_code)
print('Response:', res.json())

from apps.vms.services.proxmox_service import ProxmoxService
ps = ProxmoxService()
vms = ps.proxmox.nodes(ps.node).qemu.get()
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(v.get('vmid'), v.get('name'), v.get('status'))
