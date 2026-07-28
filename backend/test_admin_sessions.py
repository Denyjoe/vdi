from rest_framework.test import APIClient
from apps.users.models import User
import json

host = User.objects.filter(email='deniswilson255@gmail.com').first()
c = APIClient()
c.force_authenticate(user=host)
res = c.post('/api/sessions/live/22/start/')
print('Start session status:', res.status_code)
print('Response:', res.json())

admin = User.objects.filter(email='deniswilson255@gmail.com', role='admin').first()
c.force_authenticate(user=admin)
res = c.get('/api/sessions/admin/live/')
print('Admin Sessions status:', res.status_code)
print('Response:', res.json())
