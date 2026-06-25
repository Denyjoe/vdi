import os, sys, django, json
from urllib import request

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.get(email='admin@dit.ac.tz')
token = str(RefreshToken.for_user(user).access_token)

urls = [
    "http://localhost:8000/api/admin/hardware/",
    "http://localhost:8000/api/admin/hardware/cpu-history/",
    "http://localhost:8000/api/admin/analytics/overview/",
    "http://localhost:8000/api/admin/analytics/session-trends/",
    "http://localhost:8000/api/admin/analytics/vm-usage/"
]

for url in urls:
    print(f"--- TEST: {url} ---")
    req = request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"Error: {e}")
        if hasattr(e, 'read'):
            print(e.read().decode('utf-8'))
    print("\n")
