import os
import django
import time
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from apps.vms.models import Workspace, VirtualMachine, VMTemplate
from apps.vms.services.guacamole_service import GuacamoleService

user = User.objects.filter(is_superuser=True).first()
if not user:
    user = User.objects.first()

template = VMTemplate.objects.first()

ws_name = f'delete-test-{random.randint(1000, 9999)}'
ws = Workspace.objects.create(
    name=ws_name,
    owner=user,
    vm_template=template,
    status='active'
)

vm = VirtualMachine.objects.create(
    name=f"workspace-{ws.id}-{user.username}",
    owner=user,
    template=template,
    status='provisioning'
)
ws.vm = vm
ws.save()

gs = GuacamoleService()
gs.authenticate()

# Clean up any leftover connections first
import requests
res = requests.get(f'{gs.base_url}/api/session/data/{gs.data_source}/connections', params={'token': gs.token})
for conn_id in res.json().keys():
    try:
        gs.delete_connection(conn_id)
        print("Cleaned up orphaned conn", conn_id)
    except Exception:
        pass

# Mock a Guacamole connection
conn_id = gs.create_connection(
    name=f'vm-{user.id}-{vm.id}',
    hostname='127.0.0.1',
    username='test',
    password='123',
    port='3389'
)
vm.guacamole_connection_id = str(conn_id) if conn_id else ''
vm.save()

print(f"Created workspace {ws.id} with Guacamole Connection ID {vm.guacamole_connection_id}")

res = requests.get(f'{gs.base_url}/api/session/data/{gs.data_source}/connections', params={'token': gs.token})
print('Connections BEFORE delete:', res.json())

# Simulate WorkspaceDeleteView logic using test client
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.vms.workspace_views import WorkspaceDeleteView

factory = APIRequestFactory()
request = factory.post(f'/api/workspaces/{ws.id}/')
force_authenticate(request, user=user)

view = WorkspaceDeleteView.as_view()
response = view(request, pk=ws.id)
print("Delete Response status:", response.status_code)

res = requests.get(f'{gs.base_url}/api/session/data/{gs.data_source}/connections', params={'token': gs.token})
print('Connections AFTER delete:', res.json())
