from rest_framework.test import APIClient
from apps.users.models import User
import json

participant = User.objects.filter(email__icontains='@').exclude(email='deniswilson255@gmail.com').first()
print('Using participant:', participant.email if participant else 'NONE FOUND')

if participant:
    c = APIClient()
    c.force_authenticate(user=participant)
    res = c.post('/api/sessions/live/join/', {'invite_code': '6TQGDPKU'}, format='json')
    print('Join status:', res.status_code)
    print('Response:', res.json())
