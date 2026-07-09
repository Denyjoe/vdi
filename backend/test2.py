import urllib.request
import json
req1 = urllib.request.Request('http://localhost:8000/api/auth/login/', data=b'{"email":"admin@clouddesk.io", "password":"CloudDesk2026!"}', headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req1) as f:
        token = json.loads(f.read())['data']['access']
    print('Token obtained.')

    req2 = urllib.request.Request('http://localhost:8000/api/workspaces/', headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req2, timeout=5) as f:
        print('HTTP_STATUS:', f.status)
        print('BODY:', f.read().decode()[:50])
except urllib.error.HTTPError as e:
    print('HTTP_STATUS:', e.code)
    print('BODY:', e.read().decode()[:50])
except Exception as e:
    print('Error:', e)
