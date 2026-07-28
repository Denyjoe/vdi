from rest_framework.test import APIClient
from apps.users.models import User
import json

host = User.objects.filter(email='deniswilson255@gmail.com').first()

c = APIClient()
c.force_authenticate(user=host)

res = c.get('/api/sessions/live/22/monitor/')
print('Monitor status:', res.status_code)
print('Response:', res.json())
