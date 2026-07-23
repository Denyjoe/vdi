import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.models import Workspace, VirtualMachine
from apps.vms.services.guacamole_service import GuacamoleService

ws = Workspace.objects.filter(vm__proxmox_vm_id=101).first()

if ws and ws.vm:
    ws.vm.ip_address = '192.168.1.29'
    ws.vm.status = 'running'
    ws.status = 'active'
    
    gs = GuacamoleService()
    
    if ws.vm.guacamole_connection_id:
        try:
            gs.delete_connection(ws.vm.guacamole_connection_id)
        except Exception:
            pass
            
    conn_id = gs.create_connection(
        name=f'vm-{ws.owner.id}-{ws.vm.id}',
        hostname='192.168.1.29',
        username='ospace',
        password='1234567890',
        port='3389'
    )
    ws.vm.guacamole_connection_id = str(conn_id) if conn_id else ''
    ws.vm.save()
    ws.save()
    print('Fixed workspace', ws.id)
else:
    print('Workspace not found for VM 101')
