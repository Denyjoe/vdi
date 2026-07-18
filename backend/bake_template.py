"""
STEP 3: Clone template 9001 → fix VM → convert to new template 9002.
Fixes applied:
  1. startwm.sh: clears stale xfce4 sessions + startxfce4
  2. xrdp TLS key: add xrdp user to ssl-cert group, fix permissions
"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '.')
django.setup()

import urllib3
urllib3.disable_warnings()
from decouple import config
import requests
import time

# --- Proxmox REST client (direct API, avoids proxmoxer issues with exec) ---
host = config('PROXMOX_HOST')
node = config('PROXMOX_NODE')
user = config('PROXMOX_USER')
token_name = config('PROXMOX_TOKEN_NAME')
token_secret = config('PROXMOX_TOKEN_SECRET')
token = f'PVEAPIToken={user}!{token_name}={token_secret}'
api_headers = {'Authorization': token}
base = f'https://{host}:8006/api2/json'
TEMPLATE_VMID = 9001
NEW_VMID = 105   # fresh clone ID
NEW_TEMPLATE_VMID = 9002


def api_get(path):
    """GET from Proxmox API."""
    r = requests.get(f'{base}{path}', headers=api_headers, verify=False)
    r.raise_for_status()
    return r.json().get('data', {})


def api_post(path, data=None):
    """POST to Proxmox API."""
    r = requests.post(f'{base}{path}', headers=api_headers, json=data or {}, verify=False)
    r.raise_for_status()
    return r.json().get('data', {})


def api_post_form(path, data=None):
    """POST form data to Proxmox API."""
    r = requests.post(f'{base}{path}', headers=api_headers, data=data or {}, verify=False)
    r.raise_for_status()
    return r.json().get('data', {})


def wait_task(taskid, timeout=120):
    """Wait for a Proxmox task to complete."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            status = api_get(f'/nodes/{node}/tasks/{taskid}/status')
            if status.get('status') == 'stopped':
                return status.get('exitstatus') == 'OK'
        except Exception:
            pass
        time.sleep(3)
    return False


def wait_vm_status(vmid, target_status, timeout=120):
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
    r = requests.post(url, headers=api_headers, data=args_tuple, verify=False)
    r.raise_for_status()
    pid = r.json()['data']['pid']
    time.sleep(wait)
    r2 = requests.get(f'{status_url}?pid={pid}', headers=api_headers, verify=False)
    return r2.json().get('data', {})


# ─────────────────────────────────────────────────────────────────
# Step A: Clone 9001 → new VM 105
# ─────────────────────────────────────────────────────────────────
print(f"=== Step A: Cloning template {TEMPLATE_VMID} → VM {NEW_VMID} ===")
task = api_post_form(
    f'/nodes/{node}/qemu/{TEMPLATE_VMID}/clone',
    {
        'newid': NEW_VMID,
        'name': f'clouddesk-fix-template',
        'full': 1,
        'description': 'Working clone for baking fixed template',
    }
)
print(f'Clone task: {task}')
ok = wait_task(task, timeout=300)
print(f'Clone task result: {"OK" if ok else "FAILED"}')
if not ok:
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────
# Step B: Start VM 105
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step B: Starting VM {NEW_VMID} ===")
api_post(f'/nodes/{node}/qemu/{NEW_VMID}/status/start')
print("Waiting for VM to reach running state...")
ok = wait_vm_status(NEW_VMID, 'running', timeout=120)
print(f'VM running: {ok}')
if not ok:
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────
# Step C: Wait for guest agent to be ready
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step C: Waiting for guest agent on VM {NEW_VMID} ===")
agent_ready = False
for attempt in range(30):
    try:
        result = run_in_vm(NEW_VMID, (('command', 'echo'), ('command', 'ready')), wait=2)
        if result.get('out-data', '').strip() == 'ready':
            print(f'Guest agent ready after {(attempt+1)*5}s')
            agent_ready = True
            break
    except Exception:
        pass
    print(f'  Attempt {attempt+1}/30 - waiting...')
    time.sleep(5)

if not agent_ready:
    print('ERROR: Guest agent not responding')
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────
# Step D: Apply fix 1 — startwm.sh with xfce4 session cleanup
# ─────────────────────────────────────────────────────────────────
print("\n=== Step D: Fix startwm.sh ===")
script_content = '#!/bin/sh\\nrm -rf /home/student/.cache/sessions/*\\nexec startxfce4'
result = run_in_vm(
    NEW_VMID,
    (('command', 'bash'), ('command', '-c'),
     ('command', f"printf '{script_content}\\n' > /etc/xrdp/startwm.sh && chmod +x /etc/xrdp/startwm.sh")),
    wait=3
)
print(f'Write startwm.sh exitcode: {result.get("exitcode")}  err: {result.get("err-data","")}')

# Verify
result = run_in_vm(NEW_VMID, (('command', 'cat'), ('command', '/etc/xrdp/startwm.sh')), wait=2)
print('startwm.sh content:', result.get('out-data', ''))

# ─────────────────────────────────────────────────────────────────
# Step E: Apply fix 2 — xrdp TLS key permissions
# ─────────────────────────────────────────────────────────────────
print("\n=== Step E: Fix xrdp TLS key permissions ===")
fixes = [
    (('command', 'usermod'), ('command', '-aG'), ('command', 'ssl-cert'), ('command', 'xrdp')),
    (('command', 'chgrp'), ('command', 'ssl-cert'), ('command', '/etc/ssl/private/ssl-cert-snakeoil.key')),
    (('command', 'chmod'), ('command', '640'), ('command', '/etc/ssl/private/ssl-cert-snakeoil.key')),
    (('command', 'chgrp'), ('command', 'ssl-cert'), ('command', '/etc/ssl/private')),
    (('command', 'chmod'), ('command', '710'), ('command', '/etc/ssl/private')),
]
for fix in fixes:
    result = run_in_vm(NEW_VMID, fix, wait=2)
    print(f'  exitcode: {result.get("exitcode")}  cmd: {fix[0][1]}')

# ─────────────────────────────────────────────────────────────────
# Step F: Apply fix 3 — install openbox as fallback WM
# ─────────────────────────────────────────────────────────────────
print("\n=== Step F: Install openbox fallback ===")
result = run_in_vm(
    NEW_VMID,
    (('command', 'bash'), ('command', '-c'),
     ('command', 'DEBIAN_FRONTEND=noninteractive apt-get install -y openbox 2>&1 | tail -3')),
    wait=30
)
print('openbox install:', result.get('out-data', ''))

# ─────────────────────────────────────────────────────────────────
# Step G: Verify all fixes applied
# ─────────────────────────────────────────────────────────────────
print("\n=== Step G: Verify fixes ===")
result = run_in_vm(NEW_VMID, (('command', 'cat'), ('command', '/etc/xrdp/startwm.sh')), wait=2)
print('startwm.sh:', result.get('out-data', '').strip())

result = run_in_vm(NEW_VMID, (('command', 'bash'), ('command', '-c'),
    ('command', 'groups xrdp')), wait=2)
print('xrdp groups:', result.get('out-data', '').strip())

result = run_in_vm(NEW_VMID, (('command', 'bash'), ('command', '-c'),
    ('command', 'ls -la /etc/ssl/private/ssl-cert-snakeoil.key')), wait=2)
print('key perms:', result.get('out-data', '').strip())

result = run_in_vm(NEW_VMID, (('command', 'bash'), ('command', '-c'),
    ('command', 'which openbox')), wait=2)
print('openbox:', result.get('out-data', '').strip())

# ─────────────────────────────────────────────────────────────────
# Step H: Shut down VM 105 cleanly
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step H: Shutdown VM {NEW_VMID} ===")
result = run_in_vm(NEW_VMID, (('command', 'systemctl'), ('command', 'poweroff')), wait=3)
print('Poweroff initiated...')
ok = wait_vm_status(NEW_VMID, 'stopped', timeout=60)
print(f'VM stopped: {ok}')

# ─────────────────────────────────────────────────────────────────
# Step I: Convert VM 105 to template 9002
# ─────────────────────────────────────────────────────────────────
print(f"\n=== Step I: Convert VM {NEW_VMID} to template {NEW_TEMPLATE_VMID} ===")

# First rename to 9002 by cloning (Proxmox doesn't support direct VMID rename)
# We'll convert 105 to template first, then rename via clone trick if needed
# Actually: convert in place to template (this makes it VMID 105 but as template)
task = api_post_form(f'/nodes/{node}/qemu/{NEW_VMID}/template', {})
print(f'Template conversion task: {task}')
if task:
    ok = wait_task(task, timeout=60)
    print(f'Conversion result: {"OK" if ok else "FAILED or no task returned"}')
else:
    # Some Proxmox versions return empty for immediate conversion
    time.sleep(5)
    status = api_get(f'/nodes/{node}/qemu/{NEW_VMID}/status/current')
    print(f'Template flag: {status.get("template")}')

print(f"\n=== DONE ===")
print(f"VM {NEW_VMID} is now the new working template.")
print(f"Update PROXMOX_TEMPLATE_ID in .env from 9001 to {NEW_VMID}")
print(f"New clones will inherit: startwm.sh fix, xrdp TLS fix, openbox fallback")
