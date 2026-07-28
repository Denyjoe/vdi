import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIClient
from apps.users.models import User
from apps.vms.models import VMTemplate, VirtualMachine, Workspace
from apps.vms.services.proxmox_service import ProxmoxService

def test():
    user = User.objects.filter(email='deniswilson255@gmail.com').first()
    template = VMTemplate.objects.filter(name__icontains='Zorin').first()
    
    # 1. Create a workspace & VM record with a fake Proxmox ID that doesn't exist
    vm = VirtualMachine.objects.create(
        name="Test Orphan VM",
        owner=user,
        template=template,
        status='running',
        proxmox_vm_id=9999 # This definitely doesn't exist in Proxmox
    )
    ws = Workspace.objects.create(
        name="Test Orphan Workspace",
        owner=user,
        vm_template=template,
        vm=vm,
        status='active'
    )
    
    ws_id = ws.id
    print(f"Created simulated orphaned workspace {ws_id} with VMID 9999")
    
    # 2. Try to delete it via the API
    c = APIClient()
    c.force_authenticate(user=user)
    
    res = c.post(f'/api/workspaces/{ws_id}/delete/')
    print("Delete response status:", res.status_code)
    print("Delete response body:", res.json())
    
    # 3. Verify it's gone
    exists = Workspace.objects.filter(id=ws_id).exists()
    print("Workspace exists in DB?:", exists)

if __name__ == '__main__':
    test()
