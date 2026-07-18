"""Check Proxmox clone task failure and list all VMs."""
import urllib3
urllib3.disable_warnings()
from decouple import config
import requests

host = config('PROXMOX_HOST')
node = config('PROXMOX_NODE')
user = config('PROXMOX_USER')
token_name = config('PROXMOX_TOKEN_NAME')
token_secret = config('PROXMOX_TOKEN_SECRET')
token = f'PVEAPIToken={user}!{token_name}={token_secret}'
headers = {'Authorization': token}
base = f'https://{host}:8006/api2/json'

taskid = 'UPID:pve:00000B03:0000EC39:6A51ECE2:qmclone:9001:root@pam!clouddesk:'

# Get task log
r = requests.get(f'{base}/nodes/{node}/tasks/{taskid}/log', headers=headers, verify=False)
print('Task log status:', r.status_code)
data = r.json().get('data', [])
for line in data:
    print(line.get('t', ''))

# List all VMs
print()
print('All VMs in Proxmox:')
r2 = requests.get(f'{base}/nodes/{node}/qemu', headers=headers, verify=False)
vms = r2.json().get('data', [])
for vm in sorted(vms, key=lambda x: x.get('vmid', 0)):
    vmid = vm.get('vmid')
    name = vm.get('name')
    status = vm.get('status')
    tmpl = vm.get('template', 0)
    print(f'  vmid={vmid} name={name} status={status} template={tmpl}')

# Check storage availability
print()
print('Storage:')
r3 = requests.get(f'{base}/nodes/{node}/storage', headers=headers, verify=False)
stores = r3.json().get('data', [])
for s in stores:
    print(f'  storage={s.get("storage")} type={s.get("type")} active={s.get("active")} avail={s.get("avail")}')
