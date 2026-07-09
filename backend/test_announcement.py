import urllib.request
try:
    req = urllib.request.Request('http://localhost:8000/api/config/announcement/')
    with urllib.request.urlopen(req) as f:
        print('HTTP_STATUS:', f.status)
        print('BODY:', f.read().decode())
except urllib.error.HTTPError as e:
    print('HTTP_STATUS:', e.code)
    print('BODY:', e.read().decode())
