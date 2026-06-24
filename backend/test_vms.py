import requests
import time
import json
import subprocess

def run_curl(command):
    print(f"\n> {command}")
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    try:
        parsed = json.loads(result.stdout)
        print(json.dumps(parsed, indent=2))
        return parsed
    except:
        print(result.stdout)
        print(result.stderr)
        return None

# Login to get token
print("Logging in as denis@dit.ac.tz...")
login_cmd = 'curl.exe -s -X POST http://localhost:8000/api/auth/login/ -H "Content-Type: application/json" -d "{\\"email\\":\\"denis@dit.ac.tz\\",\\"password\\":\\"Test1234!\\"}"'
login_res = run_curl(login_cmd)
token = login_res['data']['access']

# TEST A
print("\n--- TEST A: Get all VM templates ---")
cmd_a = f'curl.exe -s http://localhost:8000/api/vms/templates/ -H "Authorization: Bearer {token}"'
run_curl(cmd_a)

# TEST B
print("\n--- TEST B: Request a VM ---")
cmd_b = f'curl.exe -s -X POST http://localhost:8000/api/vms/request/ -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d "{{\\"template_id\\": 1, \\"notes\\": \\"AutoCAD assignment\\"}}"'
res_b = run_curl(cmd_b)
vm_id = res_b['data']['id']

# TEST C
print("\nWaiting 10 seconds for provisioning...")
time.sleep(10)
print("\n--- TEST C: Check status after 10 seconds ---")
cmd_c = f'curl.exe -s http://localhost:8000/api/vms/{vm_id}/status/ -H "Authorization: Bearer {token}"'
run_curl(cmd_c)

# TEST D
print("\n--- TEST D: Request second VM while first running ---")
cmd_d = f'curl.exe -s -X POST http://localhost:8000/api/vms/request/ -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d "{{\\"template_id\\": 2, \\"notes\\": \\"test\\"}}"'
run_curl(cmd_d)
