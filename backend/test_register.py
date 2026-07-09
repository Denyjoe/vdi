import urllib.request
import json
req = urllib.request.Request('http://localhost:8000/api/auth/register/', data=b'{"email":"newtest@test.com", "password":"Test12345", "first_name":"New", "last_name":"Test"}', headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as f:
        print('HTTP_STATUS:', f.status)
        print('BODY:', f.read().decode()[:100])
except urllib.error.HTTPError as e:
    print('HTTP_STATUS:', e.code)
    print('BODY:', e.read().decode()[:100])
