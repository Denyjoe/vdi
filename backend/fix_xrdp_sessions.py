"""
Fix the window manager crash by killing stale xrdp sessions and restarting cleanly.
The WM crash (exit 139) happens because there's already a session on display :10.
"""

import urllib3
urllib3.disable_warnings()
from decouple import config
import requests
import json
import time

host = config('PROXMOX_HOST')
node = config('PROXMOX_NODE')
user = config('PROXMOX_USER')
token_name = config('PROXMOX_TOKEN_NAME')
token_secret = config('PROXMOX_TOKEN_SECRET')
token = f'PVEAPIToken={user}!{token_name}={token_secret}'
headers = {'Authorization': token}
url = f'https://{host}:8006/api2/json/nodes/{node}/qemu/101/agent/exec'
status_url = f'https://{host}:8006/api2/json/nodes/{node}/qemu/101/agent/exec-status'


def run_cmd(args_tuple, wait=2):
    """Run a command inside VM 101 via guest agent and return output."""
    res = requests.post(url, headers=headers, data=args_tuple, verify=False)
    pid = res.json()['data']['pid']
    time.sleep(wait)
    res2 = requests.get(f'{status_url}?pid={pid}', headers=headers, verify=False)
    data = res2.json().get('data', {})
    return data


# Step 1: Kill ALL existing xrdp sessions (Xorg instances for xrdp)
print("=== Step 1: Kill stale X sessions ===")
result = run_cmd((('command', 'bash'), ('command', '-c'), 
                  ('command', 'pkill -9 -f "Xorg.*xrdp" || true; pkill -9 xfce4-session || true; pkill -9 xfwm4 || true; pkill -9 xfdesktop || true; pkill -9 xfce4-panel || true')))
print("kill result:", result.get('exitcode'), result.get('err-data', ''))

# Step 2: Clean up stale X sockets
print("=== Step 2: Clean up X sockets ===")
result = run_cmd((('command', 'bash'), ('command', '-c'), 
                  ('command', 'rm -f /tmp/.X11-unix/X10 /tmp/.X11-unix/X11 /tmp/.X*-lock')))
print("cleanup result:", result.get('exitcode'))

# Step 3: Restart both xrdp services
print("=== Step 3: Restart xrdp services ===")
result = run_cmd((('command', 'systemctl'), ('command', 'restart'), ('command', 'xrdp-sesman')), wait=3)
print("sesman restart:", result.get('exitcode'))

result = run_cmd((('command', 'systemctl'), ('command', 'restart'), ('command', 'xrdp')), wait=3)
print("xrdp restart:", result.get('exitcode'))

# Step 4: Verify both are running
print("=== Step 4: Verify services ===")
result = run_cmd((('command', 'systemctl'), ('command', 'is-active'), ('command', 'xrdp')))
print("xrdp:", result.get('out-data', '').strip())

result = run_cmd((('command', 'systemctl'), ('command', 'is-active'), ('command', 'xrdp-sesman')))
print("sesman:", result.get('out-data', '').strip())

# Step 5: Verify no stale X sessions
print("=== Step 5: Check for stale X sessions ===")
result = run_cmd((('command', 'bash'), ('command', '-c'), ('command', 'ls -la /tmp/.X11-unix/ 2>/dev/null || echo empty')))
print("X sockets:", result.get('out-data', ''))

result = run_cmd((('command', 'bash'), ('command', '-c'), ('command', 'pgrep -a Xorg || echo no_xorg')))
print("Xorg procs:", result.get('out-data', ''))

print("\n=== DONE. Ready for Guacamole to connect fresh. ===")
