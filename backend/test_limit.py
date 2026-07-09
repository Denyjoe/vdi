import urllib.request
import json
req = urllib.request.Request('http://localhost:8000/api/auth/login/', data=b'{"email":"user@clouddesk.io", "password":"CloudDesk2026!"}', headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as f:
    token = json.loads(f.read())['data']['access']

def make_workspace():
    req2 = urllib.request.Request('http://localhost:8000/api/workspaces/create/', data=b'{"vm_template": 13, "name": "Limit Test"}', headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req2) as f:
            print('HTTP_STATUS:', f.status)
            print('BODY:', f.read().decode()[:100])
    except urllib.error.HTTPError as e:
        print('HTTP_STATUS:', e.code)
        print('BODY:', e.read().decode()[:100])

make_workspace()
make_workspace()
