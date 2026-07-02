import os
import django
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.users.models import User
from apps.sessions.models import LiveSession, SessionParticipant
from django.test import Client
from django.utils import timezone

def run_tests():
    c = Client(SERVER_NAME='localhost')
    
    print("Testing Host Login...")
    res = c.post('/api/auth/login/', {'email': 'host@clouddesk.io', 'password': 'CloudDesk2026!'}, content_type="application/json")
    assert res.status_code == 200, res.json()
    host_token = res.json()['data']['access']
    
    print("Testing Session Creation...")
    res = c.post('/api/sessions/live/create/', {
        'name': 'Test Session',
        'session_type': 'workshop',
        'start_time': (timezone.now() + timezone.timedelta(days=1)).isoformat(),
        'end_time': (timezone.now() + timezone.timedelta(days=1, hours=2)).isoformat(),
        'max_participants': 20
    }, HTTP_AUTHORIZATION=f'Bearer {host_token}', content_type="application/json")
    assert res.status_code == 201, res.json()
    invite_code = res.json()['invite_code']
    print(f"Session Created: {invite_code}")
    
    print("Testing User Login...")
    res = c.post('/api/auth/login/', {'email': 'user@clouddesk.io', 'password': 'CloudDesk2026!'}, content_type="application/json")
    assert res.status_code == 200, res.json()
    user_token = res.json()['data']['access']
    
    print("Testing Session Join...")
    res = c.post('/api/sessions/live/join/', {'invite_code': invite_code}, HTTP_AUTHORIZATION=f'Bearer {user_token}', content_type="application/json")
    assert res.status_code == 200, res.json()
    print("Successfully joined session!")
    
    print("ALL TESTS PASSED.")

if __name__ == '__main__':
    run_tests()
