from rest_framework.test import APIClient
from apps.users.models import User
from apps.vms.models import VMTemplate
import json

host = User.objects.filter(email='deniswilson255@gmail.com').first()
if not host.is_host:
    host.is_host = True
    host.save()

template = VMTemplate.objects.get(name='Ubuntu Desktop')

c = APIClient()
c.force_authenticate(user=host)

res = c.post(
    '/api/sessions/live/create/', 
    {
        'name': 'Session Audit Test',
        'vm_template': template.id,
        'max_participants': 5,
        'restrictions': {
            'internet': True,
            'clipboard': True,
            'file_transfer': False,
            'usb': False,
        }
    }, format='json')
print('Create status:', res.status_code)
print('Response:', res.json())
