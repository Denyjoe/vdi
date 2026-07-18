"""
Fix xrdp TLS key permission issue on VM 101.
The /etc/xrdp/key.pem symlink points to /etc/ssl/private/ssl-cert-snakeoil.key
which has restricted permissions that xrdp cannot read.
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


def run_cmd(args_tuple):
    """Run a command inside VM 101 via guest agent and return output."""
    res = requests.post(url, headers=headers, data=args_tuple, verify=False)
    pid = res.json()['data']['pid']
    time.sleep(2)
    res2 = requests.get(f'{status_url}?pid={pid}', headers=headers, verify=False)
    data = res2.json().get('data', {})
    return data


# Step 1: Check current key file permissions
print("=== Step 1: Check current permissions ===")
result = run_cmd((('command', 'ls'), ('command', '-la'), ('command', '/etc/ssl/private/')))
print(result.get('out-data', ''))

# Step 2: Add xrdp to ssl-cert group
print("=== Step 2: Add xrdp to ssl-cert group ===")
result = run_cmd((('command', 'usermod'), ('command', '-aG'), ('command', 'ssl-cert'), ('command', 'xrdp')))
print("exitcode:", result.get('exitcode'), "err:", result.get('err-data', ''))

# Step 3: Fix key file group and permissions
print("=== Step 3: Fix key file permissions ===")
result = run_cmd((('command', 'chgrp'), ('command', 'ssl-cert'), ('command', '/etc/ssl/private/ssl-cert-snakeoil.key')))
print("chgrp exitcode:", result.get('exitcode'))

result = run_cmd((('command', 'chmod'), ('command', '640'), ('command', '/etc/ssl/private/ssl-cert-snakeoil.key')))
print("chmod key exitcode:", result.get('exitcode'))

# Step 4: Fix directory permissions so xrdp can traverse
print("=== Step 4: Fix directory permissions ===")
result = run_cmd((('command', 'chmod'), ('command', '710'), ('command', '/etc/ssl/private')))
print("chmod dir exitcode:", result.get('exitcode'))

result = run_cmd((('command', 'chgrp'), ('command', 'ssl-cert'), ('command', '/etc/ssl/private')))
print("chgrp dir exitcode:", result.get('exitcode'))

# Step 5: Verify
print("=== Step 5: Verify ===")
result = run_cmd((('command', 'ls'), ('command', '-la'), ('command', '/etc/ssl/private/')))
print(result.get('out-data', ''))

# Step 6: Restart xrdp
print("=== Step 6: Restart xrdp ===")
result = run_cmd((('command', 'systemctl'), ('command', 'restart'), ('command', 'xrdp')))
print("restart exitcode:", result.get('exitcode'))
time.sleep(2)

# Step 7: Check xrdp status
print("=== Step 7: Check xrdp status ===")
result = run_cmd((('command', 'systemctl'), ('command', 'status'), ('command', 'xrdp')))
print(result.get('out-data', ''))

# Step 8: Check xrdp log for errors
print("=== Step 8: Check xrdp log tail ===")
result = run_cmd((('command', 'tail'), ('command', '-n'), ('command', '10'), ('command', '/var/log/xrdp.log')))
print(result.get('out-data', ''))
