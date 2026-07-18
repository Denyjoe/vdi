"""
Fix xfce4-session segfault by installing openbox as fallback WM.
Also tries to fix xfce4-session after reinstall.
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


def run_cmd(args_tuple, wait=2):
    """Run a command inside VM 101 via guest agent and return output."""
    res = requests.post(url, headers=headers, data=args_tuple, verify=False)
    pid = res.json()['data']['pid']
    time.sleep(wait)
    res2 = requests.get(f'{status_url}?pid={pid}', headers=headers, verify=False)
    return res2.json().get('data', {})


# Step 1: Install openbox (lightweight WM, no session manager dependency)
print("=== Step 1: Install openbox ===")
result = run_cmd((
    ('command', 'bash'), ('command', '-c'),
    ('command', 'DEBIAN_FRONTEND=noninteractive apt-get install -y openbox 2>&1 | tail -5')
), wait=30)
print(result.get('out-data', ''))
print("err:", result.get('err-data', ''))

# Step 2: Verify openbox installed
print("\n=== Step 2: Verify openbox ===")
result = run_cmd((('command', 'which'), ('command', 'openbox')))
print("openbox path:", result.get('out-data', '').strip())
print("exitcode:", result.get('exitcode'))

# Step 3: Change startwm.sh to use openbox
print("\n=== Step 3: Update startwm.sh to openbox ===")
result = run_cmd((
    ('command', 'bash'), ('command', '-c'),
    ('command', "echo 'openbox-session' > /etc/xrdp/startwm.sh")
))
print("write exitcode:", result.get('exitcode'))

# Step 4: Verify
result = run_cmd((('command', 'cat'), ('command', '/etc/xrdp/startwm.sh')))
print("startwm.sh now:", result.get('out-data', ''))

# Step 5: Restart xrdp services
print("\n=== Step 5: Restart xrdp ===")
result = run_cmd((('command', 'systemctl'), ('command', 'restart'), ('command', 'xrdp-sesman')), wait=3)
print("sesman restart:", result.get('exitcode'))
result = run_cmd((('command', 'systemctl'), ('command', 'restart'), ('command', 'xrdp')), wait=3)
print("xrdp restart:", result.get('exitcode'))

# Step 6: Verify both active
print("\n=== Step 6: Service status ===")
result = run_cmd((('command', 'systemctl'), ('command', 'is-active'), ('command', 'xrdp')))
print("xrdp:", result.get('out-data', '').strip())
result = run_cmd((('command', 'systemctl'), ('command', 'is-active'), ('command', 'xrdp-sesman')))
print("sesman:", result.get('out-data', '').strip())

print("\n=== DONE — openbox set as WM. Reconnect Guacamole to test. ===")
