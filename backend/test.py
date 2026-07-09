import urllib.request
import json
req1 = urllib.request.Request('http://localhost:8000/api/auth/login/', data=b'{"email":"user@clouddesk.io", "password":"CloudDesk2026!"}', headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req1) as f:
    token = json.loads(f.read())['data']['access']
print('Token:', token[:10] + '...')

req2 = urllib.request.Request('http://localhost:8000/api/workspaces/', headers={'Authorization': 'Bearer ' + token})
try:
    with urllib.request.urlopen(req2) as f:
        print('HTTP_STATUS:', f.status)
        print('BODY:', f.read().decode()[:200])
except urllib.error.HTTPError as e:
    print('HTTP_STATUS:', e.code)
    print('BODY:', e.read().decode()[:200])
