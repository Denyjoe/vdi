"""
Diagnose and fix the startxfce4 segfault (exit code 139).
Check xsession-errors, try alternative WM, fix xfce4 config.
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


# Step 1: Check xsession-errors (last 50 lines, freshest errors)
print("=== Step 1: xsession-errors ===")
result = run_cmd((('command', 'tail'), ('command', '-n'), ('command', '50'),
                  ('command', '/home/student/.xsession-errors')))
print(result.get('out-data', ''))
print("STDERR:", result.get('err-data', ''))

# Step 2: Check if xfce4 packages are intact
print("\n=== Step 2: xfce4 installed? ===")
result = run_cmd((('command', 'bash'), ('command', '-c'),
                  ('command', 'dpkg -l xfce4 xfce4-session xfwm4 xfdesktop4 2>&1 | grep -E "^(ii|un|rc)"')))
print(result.get('out-data', ''))

# Step 3: Try running startxfce4 manually to get error output
print("\n=== Step 3: Test startxfce4 directly ===")
result = run_cmd((('command', 'bash'), ('command', '-c'),
                  ('command', 'DISPLAY=:10 timeout 3 startxfce4 2>&1 || echo FAILED_EXIT')), wait=5)
print("out:", result.get('out-data', ''))
print("err:", result.get('err-data', ''))

# Step 4: Check if /home/student/.config/xfce4 is corrupted
print("\n=== Step 4: Check xfce4 config ===")
result = run_cmd((('command', 'ls'), ('command', '-la'), ('command', '/home/student/.config/xfce4/')))
print(result.get('out-data', ''))

# Step 5: Check current startwm.sh
print("\n=== Step 5: Current startwm.sh ===")
result = run_cmd((('command', 'cat'), ('command', '/etc/xrdp/startwm.sh')))
print(result.get('out-data', ''))

# Step 6: Try switching WM to openbox (lightweight, stable)
print("\n=== Step 6: Check if openbox installed ===")
result = run_cmd((('command', 'bash'), ('command', '-c'),
                  ('command', 'which openbox && echo openbox_found || echo no_openbox')))
print(result.get('out-data', ''))

# Step 7: Delete corrupted xfce4 session cache
print("\n=== Step 7: Clear xfce4 session cache ===")
result = run_cmd((('command', 'bash'), ('command', '-c'),
                  ('command', 'rm -rf /home/student/.cache/sessions/* /home/student/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-session.xml 2>&1 || true')))
print("Clear cache exitcode:", result.get('exitcode'))

# Step 8: Try using xfce4-session with --disable-tcp flag explicitly
print("\n=== Step 8: Reinstall xfce4-session ===")
result = run_cmd((('command', 'bash'), ('command', '-c'),
                  ('command', 'apt-get install --reinstall -y xfce4-session xfwm4 xfdesktop4 2>&1 | tail -5')), wait=30)
print(result.get('out-data', ''))
print("err:", result.get('err-data', ''))
