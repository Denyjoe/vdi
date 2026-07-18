"""
List and delete all orphaned Guacamole connections from test attempts.
"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '.')
django.setup()

from apps.vms.services.guacamole_service import GuacamoleService
import requests

gs = GuacamoleService()
gs.authenticate()

base_url = gs.base_url.rstrip('/')
token = gs.token
data_source = gs.data_source

# List all connections
resp = requests.get(
    f'{base_url}/api/session/data/{data_source}/connections',
    params={'token': token}
)
print('Status:', resp.status_code)
conns = resp.json()
print(f'Found {len(conns)} connections:')
for cid, conn in conns.items():
    name = conn.get('name', '')
    protocol = conn.get('protocol', '')
    print(f'  ID={cid}  name={name}  protocol={protocol}')

# Delete all connections
print('\nDeleting all connections...')
for cid, conn in conns.items():
    name = conn.get('name', '')
    try:
        del_resp = requests.delete(
            f'{base_url}/api/session/data/{data_source}/connections/{cid}',
            params={'token': token}
        )
        print(f'  Deleted ID={cid} ({name}): HTTP {del_resp.status_code}')
    except Exception as e:
        print(f'  Failed to delete ID={cid}: {e}')

print('\nDone.')
