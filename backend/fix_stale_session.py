"""
Fix Xorg startup failure for new RDP sessions.
Kill stale session on display :10, ensure xorgxrdp module works.
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
url = f'https://{host}:8006/api2/json/nodes/{node}/qemu/101/agent/exec'
status_url = f'https://{host}:8006/api2/json/nodes/{node}/qemu/101/agent/exec-status'


def run_cmd(args, wait=2):
    """Run a command inside VM 101 via guest agent and return output."""
    res = requests.post(url, headers=headers, data=args, verify=False)
    pid = res.json()['data']['pid']
    time.sleep(wait)
    res2 = requests.get(f'{status_url}?pid={pid}', headers=headers, verify=False)
    return res2.json().get('data', {})


# Step 1: Check what's running on display :10
print("=== Step 1: Current X sessions ===")
r = run_cmd((('command', 'bash'), ('command', '-c'),
             ('command', 'pgrep -a Xorg; echo "---"; ls -la /tmp/.X11-unix/')))
print(r.get('out-data', ''))

# Step 2: Kill ALL stale X sessions
print("\n=== Step 2: Kill stale X/openbox sessions ===")
r = run_cmd((('command', 'bash'), ('command', '-c'),
             ('command', 'pkill -9 openbox 2>/dev/null; pkill -9 -f "Xorg.*xrdp" 2>/dev/null; '
                         'rm -f /tmp/.X11-unix/X10 /tmp/.X11-unix/X11 /tmp/.X*-lock 2>/dev/null; '
                         'echo done')), wait=3)
print(r.get('out-data', ''))

# Step 3: Check xorgxrdp module is installed
print("\n=== Step 3: Check xorgxrdp installed ===")
r = run_cmd((('command', 'bash'), ('command', '-c'),
             ('command', 'dpkg -l xorgxrdp 2>&1')))
print(r.get('out-data', ''))

# Step 4: Check /var/log/Xorg.10.log for clues on xorg failure
print("\n=== Step 4: Check Xorg log ===")
r = run_cmd((('command', 'bash'), ('command', '-c'),
             ('command', 'find /home/student -name ".xorgxrdp.*.log" | head -3 | xargs tail -20 2>/dev/null || echo no_log')))
print(r.get('out-data', ''))

# Step 5: Check xrdp.ini for Xorg config
print("\n=== Step 5: xrdp.ini Xorg section ===")
r = run_cmd((('command', 'bash'), ('command', '-c'),
             ('command', 'grep -A 20 "\\[Xorg\\]" /etc/xrdp/xrdp.ini')))
print(r.get('out-data', ''))

# Step 6: Restart xrdp-sesman to clear state
print("\n=== Step 6: Restart services ===")
r = run_cmd((('command', 'systemctl'), ('command', 'restart'), ('command', 'xrdp-sesman')), wait=3)
print("sesman restart:", r.get('exitcode'))
r = run_cmd((('command', 'systemctl'), ('command', 'restart'), ('command', 'xrdp')), wait=3)
print("xrdp restart:", r.get('exitcode'))

# Step 7: Verify clean state
print("\n=== Step 7: Verify clean state ===")
r = run_cmd((('command', 'bash'), ('command', '-c'),
             ('command', 'pgrep -a Xorg || echo no_xorg_running; ls /tmp/.X11-unix/ 2>/dev/null || echo no_x_sockets')))
print(r.get('out-data', ''))

r = run_cmd((('command', 'systemctl'), ('command', 'is-active'), ('command', 'xrdp')))
print("xrdp:", r.get('out-data', '').strip())
r = run_cmd((('command', 'systemctl'), ('command', 'is-active'), ('command', 'xrdp-sesman')))
print("sesman:", r.get('out-data', '').strip())

print("\n=== DONE — Services clean. Reconnect Guacamole now. ===")
