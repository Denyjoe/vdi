from rest_framework.test import APIClient
from apps.users.models import User
from apps.vms.models import VMTemplate
from apps.sessions.models import LiveSession, SessionParticipant
import time

host = User.objects.filter(email='deniswilson255@gmail.com').first()
participant = User.objects.filter(email='denyjoefx@gmail.com').first()
template = VMTemplate.objects.filter(name='Ubuntu Desktop').first()

c1 = APIClient()
c1.force_authenticate(user=host)
res = c1.post('/api/sessions/live/pay-and-start/', {
    'name': 'Fresh Join Test',
    'vm_template': template.id,
    'hours': 1,
    'max_participants': 5,
    'restrictions': {},
    'phone_number': '0712345678',
    'provider': 'mpesa',
}, format='json')
print('Create status:', res.status_code)
data = res.json()
print('Response:', data)
invite_code = data.get('data', {}).get('invite_code')
print('Invite code:', invite_code)

c2 = APIClient()
c2.force_authenticate(user=participant)
res2 = c2.post('/api/sessions/live/join/', {
    'invite_code': invite_code
}, format='json')
print('Join status:', res2.status_code)
print('Join response:', res2.json())

print()
print('=== POLLING PARTICIPANT STATUS (up to 3 min) ===')
for i in range(36):
    time.sleep(5)
    p = SessionParticipant.objects.filter(
        user=participant).order_by('-id').first()
    vm_status = p.vm.status if p.vm else 'no-vm'
    guac_id = p.vm.guacamole_connection_id if p.vm else None
    print(f'[{(i+1)*5}s] participant_status={p.status} vm_status={vm_status} guac_id={guac_id}')
    if p.status == 'connected':
        print('SUCCESS - reached connected')
        break
    if p.status == 'error':
        print('FAILED - error status')
        break
