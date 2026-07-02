import requests
import json
API = 'http://localhost:8000/api'

# Test plans endpoint (public)
r = requests.get(f'{API}/subscriptions/plans/')
print('Plans:', r.status_code, len(r.json().get('data', [])), 'plans')

# Login as member
r = requests.post(f'{API}/auth/login/', json={'email': 'member@clouddesk.io', 'password': 'Admin2026!'})
print('Login response:', r.status_code)
if r.status_code == 200:
    token = r.json()['data']['access']
    headers = {'Authorization': f'Bearer {token}'}

    # Test groups discover
    r = requests.get(f'{API}/groups/discover/')
    print('Public groups:', r.status_code, len(r.json().get('data', [])))

    # Get code via API instead
    r = requests.get(f'{API}/groups/', headers=headers)
    print('My groups:', r.status_code)

    # Test subscription
    r = requests.get(f'{API}/subscriptions/my-plan/', headers=headers)
    print('My plan:', r.status_code, r.json().get('data', {}).get('plan', {}).get('name'))
else:
    print('Failed to login:', r.text)

print('All endpoints OK')
