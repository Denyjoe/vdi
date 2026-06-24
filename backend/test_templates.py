import requests

token = requests.post(
    'http://127.0.0.1:8000/api/auth/login/',
    json={'email': 'admin@dit.ac.tz', 'password': 'Test1234!'}
).json()['data']['access']

r = requests.get(
    'http://127.0.0.1:8000/api/admin/vms/templates/',
    headers={'Authorization': f'Bearer {token}'}
)
data = r.json()
print(f'Status: {r.status_code}')
print(f'Total templates returned: {len(data["data"])}')
for t in data['data']:
    status = "AVAILABLE" if t['is_available'] else "hidden"
    print(f'  [{status}] {t["name"]} | icon={t["icon"]}')
