import requests
import json
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

BASE_URL = 'http://localhost:8000/api'

# Login as lecturer
from rest_framework_simplejwt.tokens import RefreshToken
from apps.users.models import User

print("--- GENERATING TOKEN ---")
user = User.objects.get(email="shija@dit.ac.tz")
refresh = RefreshToken.for_user(user)
token = str(refresh.access_token)

headers = {"Authorization": f"Bearer {token}"}

print("\n--- TEST A: List Exam Sessions ---")
res_a = requests.get(f"{BASE_URL}/sessions/exam-sessions/", headers=headers)
try:
    print(json.dumps(res_a.json(), indent=2))
except Exception:
    print("Failed to decode JSON:", res_a.text)

print("\n--- TEST B: Start Exam ---")
res_b = requests.post(f"{BASE_URL}/sessions/exam-sessions/1/start/", headers=headers)
print(json.dumps(res_b.json(), indent=2))

print("\n--- TEST C: Get Monitor Data ---")
res_c = requests.get(f"{BASE_URL}/sessions/lecturer/monitor/", headers=headers)
print(json.dumps(res_c.json(), indent=2))

print("\n--- TEST D: End Exam ---")
res_d = requests.post(f"{BASE_URL}/sessions/exam-sessions/1/end/", headers=headers)
print(json.dumps(res_d.json(), indent=2))
