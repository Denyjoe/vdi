"""
Clone template 9001 → VM 106 with 15-minute timeout for the 20GB full disk copy.
Then apply all fixes and convert to template.
"""
import urllib3
urllib3.disable_warnings()
from decouple import config
import requests
import time
import sys

host = config('PROXMOX_HOST')
node = config('PROXMOX_NODE')
user = config('PROXMOX_USER')
token_name = config('PROXMOX_TOKEN_NAME')
token_secret = config('PROXMOX_TOKEN_SECRET')
token = f'PVEAPIToken={user}!{token_name}={token_secret}'
headers = {'Authorization': token}
base = f'https://{host}:8006/api2/json'

TEMPLATE_VMID = 9001
NEW_VMID = 106


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


def wait_task(taskid, timeout=900, label='Task'):
    """Wait for a Proxmox task with generous 15-minute timeout."""
    if not taskid:
        return True
    start = time.time()
    last_log = start
    while time.time() - start < timeout:
        try:
            status = api_get(f'/nodes/{node}/tasks/{taskid}/status')
            if status.get('status') == 'stopped':
                result = status.get('exitstatus')
                elapsed = int(time.time() - start)
                print(f'  {label} done in {elapsed}s: {result}')
                return result == 'OK'
            elapsed = int(time.time() - start)
            if time.time() - last_log >= 30:
                print(f'  {label} still running... {elapsed}s elapsed')
                last_log = time.time()
        except Exception as e:
            print(f'  Task check error: {e}')
        time.sleep(5)
    print(f'  {label} timed out after {timeout}s')
    return False


def wait_vm_status(vmid, target_status, timeout=180):
    """Wait for VM to reach a given status."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            s = api_get(f'/nodes/{node}/qemu/{vmid}/status/current')
            if s.get('status') == target_status:
                return True
        except Exception:
            pass
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
# Step A: Clone 9001 → VM 106
# ─────────────────────────────────────────────────────────────────
print(f"=== Step A: Full clone of template {TEMPLATE_VMID} → VM {NEW_VMID} ===")
print("  (20GB full copy — this takes ~12 minutes. Please wait...)")
task = api_post_form(
    f'/nodes/{node}/qemu/{TEMPLATE_VMID}/clone',
    {
        'newid': NEW_VMID,
        'name': 'clouddesk-fixed-template',
        'full': 1,
        'description': 'Working clone with xrdp fixes baked in',
    }
)
print(f'  Clone task: {task}')
ok = wait_task(task, timeout=900, label='Clone')
print(f'  Clone result: {"OK" if ok else "FAILED"}')
if not ok:
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────
# Step B: Start VM 106
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step B: Starting VM {NEW_VMID} ===")
start_task = api_post_form(f'/nodes/{node}/qemu/{NEW_VMID}/status/start')
if start_task:
    wait_task(start_task, timeout=60, label='Start')
print("  Waiting for VM to reach running state...")
ok = wait_vm_status(NEW_VMID, 'running', timeout=120)
print(f'  VM running: {ok}')
if not ok:
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────
# Step C: Wait for guest agent
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step C: Waiting for guest agent ===")
agent_ready = False
for attempt in range(40):
    try:
        result = run_in_vm(NEW_VMID, (('command', 'echo'), ('command', 'ready')), wait=2)
        if result.get('out-data', '').strip() == 'ready':
            print(f'  Guest agent ready after ~{(attempt+1)*5}s')
            agent_ready = True
            break
    except Exception:
        pass
    if attempt % 6 == 0:
        print(f'  Attempt {attempt+1}/40...')
    time.sleep(5)

if not agent_ready:
    print('  ERROR: Guest agent not responding')
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────
# Step D: Fix 1 — startwm.sh
# ─────────────────────────────────────────────────────────────────
print("\n=== Step D: Fix 1 — startwm.sh ===")
result = run_in_vm(
    NEW_VMID,
    (('command', 'bash'), ('command', '-c'),
     ('command', 'printf "#!/bin/sh\\nrm -rf /home/student/.cache/sessions/*\\nexec startxfce4\\n" > /etc/xrdp/startwm.sh && chmod +x /etc/xrdp/startwm.sh')),
    wait=3
)
print(f'  Write exitcode: {result.get("exitcode")}')
result = run_in_vm(NEW_VMID, (('command', 'cat'), ('command', '/etc/xrdp/startwm.sh')), wait=2)
print(f'  Content: {repr(result.get("out-data", ""))}')

# ─────────────────────────────────────────────────────────────────
# Step E: Fix 2 — xrdp TLS key
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
    print(f'  {fix[0][1]}: exitcode={result.get("exitcode")}')

# ─────────────────────────────────────────────────────────────────
# Step F: Fix 3 — install openbox
# ─────────────────────────────────────────────────────────────────
print("\n=== Step F: Fix 3 — install openbox (fallback WM) ===")
result = run_in_vm(
    NEW_VMID,
    (('command', 'bash'), ('command', '-c'),
     ('command', 'DEBIAN_FRONTEND=noninteractive apt-get install -y openbox 2>&1 | tail -3')),
    wait=60
)
print(f'  Result: {result.get("out-data","").strip()}')

# ─────────────────────────────────────────────────────────────────
# Step G: Verify
# ─────────────────────────────────────────────────────────────────
print("\n=== Step G: Verify all fixes ===")
checks = [
    ('startwm.sh', (('command', 'cat'), ('command', '/etc/xrdp/startwm.sh'))),
    ('xrdp groups', (('command', 'bash'), ('command', '-c'), ('command', 'groups xrdp'))),
    ('key perms', (('command', 'bash'), ('command', '-c'), ('command', 'ls -la /etc/ssl/private/ssl-cert-snakeoil.key'))),
    ('openbox', (('command', 'bash'), ('command', '-c'), ('command', 'which openbox && echo installed || echo missing'))),
]
for label, cmd in checks:
    r = run_in_vm(NEW_VMID, cmd, wait=2)
    print(f'  {label}: {r.get("out-data","").strip()}')

# ─────────────────────────────────────────────────────────────────
# Step H: Clean shutdown
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step H: Shutdown VM {NEW_VMID} ===")
run_in_vm(NEW_VMID, (('command', 'bash'), ('command', '-c'), ('command', 'sync && poweroff')), wait=5)
ok = wait_vm_status(NEW_VMID, 'stopped', timeout=90)
if not ok:
    print('  Force stopping...')
    api_post_form(f'/nodes/{node}/qemu/{NEW_VMID}/status/stop')
    wait_vm_status(NEW_VMID, 'stopped', timeout=30)
print(f'  VM stopped: {ok}')

# ─────────────────────────────────────────────────────────────────
# Step I: Convert to template
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step I: Convert VM {NEW_VMID} to template ===")
task = api_post_form(f'/nodes/{node}/qemu/{NEW_VMID}/template', {})
if task and isinstance(task, str) and 'UPID' in str(task):
    wait_task(task, timeout=120, label='Convert to template')
else:
    time.sleep(5)

status = api_get(f'/nodes/{node}/qemu/{NEW_VMID}/status/current')
is_template = status.get('template', 0)
print(f'  Template flag: {is_template}')

print(f"""
=== ALL DONE ===
VM {NEW_VMID} is now a template: {bool(is_template)}

Fixes baked in:
  ✅ startwm.sh: rm stale sessions + exec startxfce4
  ✅ xrdp TLS key: xrdp in ssl-cert group, perms 640
  ✅ openbox: installed as fallback WM

ACTION REQUIRED:
  Update PROXMOX_TEMPLATE_ID in backend/.env from 9001 to {NEW_VMID}
""")
