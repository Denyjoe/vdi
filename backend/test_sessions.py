import requests
import time

BASE_URL = 'http://127.0.0.1:8000/api'

# Login as student
token = requests.post(f'{BASE_URL}/auth/login/', json={'email': 'denis@dit.ac.tz', 'password': 'Test1234!'}).json()['data']['access']
headers = {'Authorization': f'Bearer {token}'}

print("--- Initializing VM for testing ---")
# First get my VMs
vms = requests.get(f'{BASE_URL}/vms/my-vms/', headers=headers).json()['data']

if not vms:
    print("No VMs found, creating one...")
    # Get a template
    templates = requests.get(f'{BASE_URL}/vms/templates/', headers=headers).json()['data']
    requests.post(f'{BASE_URL}/vms/request/', headers=headers, json={'template_id': templates[0]['id'], 'notes': 'Test VM'})
    vms = requests.get(f'{BASE_URL}/vms/my-vms/', headers=headers).json()['data']

vm = vms[0]
vm_id = vm['id']
print(f"Using VM ID: {vm_id}")

if vm['status'] != 'running':
    print(f"VM is {vm['status']}, starting it...")
    requests.post(f'{BASE_URL}/vms/{vm_id}/start/', headers=headers)
    while True:
        status = requests.get(f'{BASE_URL}/vms/{vm_id}/status/', headers=headers).json()['data']['status']
        print(f"Status: {status}")
        if status == 'running':
            break
        time.sleep(2)

print("\n=== TEST A: Connect to session ===")
res_a = requests.post(f'{BASE_URL}/sessions/connect/', headers=headers, json={'vm_id': vm_id})
print(f"Status Code: {res_a.status_code}")
print(res_a.json())
session_id = res_a.json().get('data', {}).get('session_id')

print("\n=== TEST B: Get active session ===")
res_b = requests.get(f'{BASE_URL}/sessions/active/', headers=headers)
print(f"Status Code: {res_b.status_code}")
print(res_b.json())

print("\n=== TEST C: Disconnect ===")
if session_id:
    # sleep for 2 seconds to get a duration > 0
    time.sleep(2)
    res_c = requests.post(f'{BASE_URL}/sessions/{session_id}/disconnect/', headers=headers)
    print(f"Status Code: {res_c.status_code}")
    print(res_c.json())
else:
    print("Failed to get session ID from Test A")

print("\n=== Stopping VM for Test D ===")
requests.post(f'{BASE_URL}/vms/{vm_id}/stop/', headers=headers)
while True:
    status = requests.get(f'{BASE_URL}/vms/{vm_id}/status/', headers=headers).json()['data']['status']
    print(f"Status: {status}")
    if status == 'stopped':
        break
    time.sleep(2)

print("\n=== TEST D: Connect to non-running VM ===")
res_d = requests.post(f'{BASE_URL}/sessions/connect/', headers=headers, json={'vm_id': vm_id})
print(f"Status Code: {res_d.status_code}")
print(res_d.json())
