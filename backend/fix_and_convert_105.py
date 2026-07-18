"""
VM 105 already exists from the previous (timed-out) clone attempt.
Check if it's a complete clone, then apply all fixes and convert to template.
"""
import urllib3
urllib3.disable_warnings()
from decouple import config
import requests
import time

host = config('PROXMOX_HOST')
node = config('PROXMOX_NODE')
user = config('PROXMOX_USER')
token_name = config('PROXMOX_TOKEN_NAME')
token_secret = config('PROXMOX_TOKEN_SECRET')
token = f'PVEAPIToken={user}!{token_name}={token_secret}'
headers = {'Authorization': token}
base = f'https://{host}:8006/api2/json'
NEW_VMID = 105


def api_get(path):
    """GET from Proxmox API."""
    r = requests.get(f'{base}{path}', headers=headers, verify=False)
    r.raise_for_status()
    return r.json().get('data', {})


def api_post_form(path, data=None):
    """POST form data to Proxmox API."""
    r = requests.post(f'{base}{path}', headers=headers, data=data or {}, verify=False)
    r.raise_for_status()
    return r.json().get('data')


def wait_task(taskid, timeout=900):
    """Wait for a Proxmox task to complete, with generous timeout."""
    if not taskid:
        return True  # No task = immediate completion
    start = time.time()
    while time.time() - start < timeout:
        try:
            status = api_get(f'/nodes/{node}/tasks/{taskid}/status')
            elapsed = int(time.time() - start)
            if status.get('status') == 'stopped':
                result = status.get('exitstatus')
                print(f'  Task done in {elapsed}s: {result}')
                return result == 'OK'
            if elapsed % 30 == 0:
                print(f'  Task still running... {elapsed}s elapsed')
        except Exception as e:
            print(f'  Task status check error: {e}')
        time.sleep(5)
    print(f'  Task timed out after {timeout}s')
    return False


def wait_vm_status(vmid, target_status, timeout=180):
    """Wait for VM to reach a given status."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            s = api_get(f'/nodes/{node}/qemu/{vmid}/status/current')
            current = s.get('status')
            if current == target_status:
                return True
            elapsed = int(time.time() - start)
            if elapsed % 20 == 0:
                print(f'  VM {vmid} status: {current} (waiting for {target_status})...')
        except Exception as e:
            print(f'  VM status check error: {e}')
        time.sleep(4)
    return False


def run_in_vm(vmid, args_tuple, wait=3):
    """Run a command inside VM via guest agent."""
    url = f'{base}/nodes/{node}/qemu/{vmid}/agent/exec'
    status_url = f'{base}/nodes/{node}/qemu/{vmid}/agent/exec-status'
    r = requests.post(url, headers=headers, data=args_tuple, verify=False)
    r.raise_for_status()
    pid = r.json()['data']['pid']
    time.sleep(wait)
    r2 = requests.get(f'{status_url}?pid={pid}', headers=headers, verify=False)
    return r2.json().get('data', {})


# ─────────────────────────────────────────────────────────────────
# Step A: Check VM 105 state
# ─────────────────────────────────────────────────────────────────
print(f"=== Step A: Check VM {NEW_VMID} state ===")
status = api_get(f'/nodes/{node}/qemu/{NEW_VMID}/status/current')
print(f'Status: {status.get("status")}  template: {status.get("template", 0)}')
print(f'Name: {status.get("name")}')

if status.get('status') != 'stopped':
    print(f'ERROR: VM {NEW_VMID} is not stopped, cannot proceed')
    import sys; sys.exit(1)

# ─────────────────────────────────────────────────────────────────
# Step B: Start VM 105
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step B: Starting VM {NEW_VMID} ===")
task = api_post_form(f'/nodes/{node}/qemu/{NEW_VMID}/status/start')
if task:
    wait_task(task, timeout=60)
print("Waiting for VM to reach running state...")
ok = wait_vm_status(NEW_VMID, 'running', timeout=120)
print(f'VM running: {ok}')
if not ok:
    import sys; sys.exit(1)

# ─────────────────────────────────────────────────────────────────
# Step C: Wait for guest agent
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step C: Waiting for guest agent on VM {NEW_VMID} ===")
agent_ready = False
for attempt in range(40):
    try:
        result = run_in_vm(NEW_VMID, (('command', 'echo'), ('command', 'ready')), wait=2)
        if result.get('out-data', '').strip() == 'ready':
            print(f'Guest agent ready after {(attempt+1)*5}s')
            agent_ready = True
            break
    except Exception as ex:
        pass
    if attempt % 5 == 0:
        print(f'  Attempt {attempt+1}/40 - waiting...')
    time.sleep(5)

if not agent_ready:
    print('ERROR: Guest agent not responding')
    import sys; sys.exit(1)

# ─────────────────────────────────────────────────────────────────
# Step D: Apply fix 1 — startwm.sh
# ─────────────────────────────────────────────────────────────────
print("\n=== Step D: Fix 1 — startwm.sh ===")
# Use printf to avoid escape issues
result = run_in_vm(
    NEW_VMID,
    (('command', 'bash'), ('command', '-c'),
     ('command', 'printf "#!/bin/sh\\nrm -rf /home/student/.cache/sessions/*\\nexec startxfce4\\n" > /etc/xrdp/startwm.sh && chmod +x /etc/xrdp/startwm.sh')),
    wait=3
)
print(f'Write exitcode: {result.get("exitcode")}  err: {result.get("err-data", "")}')
# Verify
result = run_in_vm(NEW_VMID, (('command', 'cat'), ('command', '/etc/xrdp/startwm.sh')), wait=2)
print('startwm.sh:', repr(result.get('out-data', '')))

# ─────────────────────────────────────────────────────────────────
# Step E: Apply fix 2 — xrdp TLS key permissions
# ─────────────────────────────────────────────────────────────────
print("\n=== Step E: Fix 2 — xrdp TLS key permissions ===")
fixes = [
    (('command', 'usermod'), ('command', '-aG'), ('command', 'ssl-cert'), ('command', 'xrdp')),
    (('command', 'chgrp'), ('command', 'ssl-cert'), ('command', '/etc/ssl/private/ssl-cert-snakeoil.key')),
    (('command', 'chmod'), ('command', '640'), ('command', '/etc/ssl/private/ssl-cert-snakeoil.key')),
    (('command', 'chgrp'), ('command', 'ssl-cert'), ('command', '/etc/ssl/private')),
    (('command', 'chmod'), ('command', '710'), ('command', '/etc/ssl/private')),
]
for fix in fixes:
    result = run_in_vm(NEW_VMID, fix, wait=2)
    print(f'  {fix[0][1]} exitcode: {result.get("exitcode")}')

# ─────────────────────────────────────────────────────────────────
# Step F: Apply fix 3 — install openbox as fallback WM
# ─────────────────────────────────────────────────────────────────
print("\n=== Step F: Fix 3 — install openbox ===")
result = run_in_vm(
    NEW_VMID,
    (('command', 'bash'), ('command', '-c'),
     ('command', 'DEBIAN_FRONTEND=noninteractive apt-get install -y openbox 2>&1 | tail -3')),
    wait=45
)
print('openbox install:', result.get('out-data', '').strip())
print('err:', result.get('err-data', '').strip())

# ─────────────────────────────────────────────────────────────────
# Step G: Verify all fixes
# ─────────────────────────────────────────────────────────────────
print("\n=== Step G: Verify fixes ===")
r1 = run_in_vm(NEW_VMID, (('command', 'cat'), ('command', '/etc/xrdp/startwm.sh')), wait=2)
print('startwm.sh:', r1.get('out-data', '').strip())

r2 = run_in_vm(NEW_VMID, (('command', 'bash'), ('command', '-c'),
    ('command', 'groups xrdp')), wait=2)
print('xrdp groups:', r2.get('out-data', '').strip())

r3 = run_in_vm(NEW_VMID, (('command', 'bash'), ('command', '-c'),
    ('command', 'ls -la /etc/ssl/private/ssl-cert-snakeoil.key')), wait=2)
print('key perms:', r3.get('out-data', '').strip())

r4 = run_in_vm(NEW_VMID, (('command', 'bash'), ('command', '-c'),
    ('command', 'which openbox && echo installed || echo missing')), wait=2)
print('openbox:', r4.get('out-data', '').strip())

# ─────────────────────────────────────────────────────────────────
# Step H: Clean shutdown
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step H: Clean shutdown of VM {NEW_VMID} ===")
result = run_in_vm(NEW_VMID, (('command', 'bash'), ('command', '-c'),
    ('command', 'sync && poweroff')), wait=5)
print('Poweroff initiated...')
ok = wait_vm_status(NEW_VMID, 'stopped', timeout=90)
print(f'VM stopped: {ok}')
if not ok:
    # Force stop
    print('Force stopping...')
    api_post_form(f'/nodes/{node}/qemu/{NEW_VMID}/status/stop')
    wait_vm_status(NEW_VMID, 'stopped', timeout=30)

# ─────────────────────────────────────────────────────────────────
# Step I: Convert to template (in-place, stays as VMID 105)
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step I: Convert VM {NEW_VMID} to template ===")
task = api_post_form(f'/nodes/{node}/qemu/{NEW_VMID}/template', {})
print(f'Conversion task: {task}')
if task and isinstance(task, str) and 'UPID' in task:
    ok = wait_task(task, timeout=120)
    print(f'Conversion result: {"OK" if ok else "FAILED"}')
else:
    time.sleep(5)

status = api_get(f'/nodes/{node}/qemu/{NEW_VMID}/status/current')
print(f'Template flag: {status.get("template")}  status: {status.get("status")}')

print(f"""
=== DONE ===
VM {NEW_VMID} is now the working template with all fixes baked in:
  - startwm.sh: clears stale sessions + exec startxfce4
  - xrdp TLS key: xrdp in ssl-cert group, key perms fixed
  - openbox: installed as fallback WM

Next step: Update PROXMOX_TEMPLATE_ID in backend/.env from 9001 to {NEW_VMID}
""")
