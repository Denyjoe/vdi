import os
import sys
import django
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

def step1():
    print("=== STEP 1 ===")
    try:
        from apps.vms.services.guacamole_service import GuacamoleService
        gs = GuacamoleService()
        gs.authenticate()
        print('Guacamole auth SUCCESS')
    except Exception as e:
        print(f"Guacamole auth FAILED: {e}")

def step2():
    print("=== STEP 2 ===")
    try:
        from apps.vms.services.proxmox_service import ProxmoxService
        ps = ProxmoxService()
        vms = ps.proxmox.nodes(ps.node).qemu.get()
        for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
            print(v.get('vmid'), v.get('name'), v.get('status'))
    except Exception as e:
        print(f"Proxmox check FAILED: {e}")

def step3():
    print("=== STEP 3 ===")
    try:
        from apps.vms.models import Workspace
        ws = Workspace.objects.order_by('-created_at').first()
        if not ws:
            print("No workspaces found.")
            return
        print('Template used:', ws.vm_template.name if ws.vm_template else None)
        print('Notes:', ws.vm.notes if hasattr(ws, 'vm') and ws.vm else 'no vm record')
    except Exception as e:
        print(f"Workspace check FAILED: {e}")

def step4():
    print("=== STEP 4 ===")
    try:
        print("Running clean_all...")
        exec(open('clean_all.py').read(), globals())
        
        from rest_framework.test import APIClient
        from apps.users.models import User
        from apps.vms.models import VMTemplate, Workspace
        
        user = User.objects.filter(email='deniswilson255@gmail.com').first()
        template = VMTemplate.objects.filter(name__icontains='Zorin').first()
        if not template:
            print("Template Zorin not found.")
            return
            
        c = APIClient()
        c.force_authenticate(user=user)

        res = c.post('/api/workspaces/create/',
            {'vm_template': template.id, 
             'name': 'Retry Test'}, 
            format='json')
        if res.status_code not in [200, 201]:
            print("Failed to create workspace:", res.status_code, res.content)
            return
        data = res.json()
        ws_id = data.get('data', {}).get('id') or data.get('id')
        print('Workspace:', ws_id)

        res_launch = c.post(f'/api/workspaces/{ws_id}/launch/')
        print('Launch trigger response:', res_launch.status_code)

        for i in range(24):
            time.sleep(5)
            ws = Workspace.objects.get(id=ws_id)
            vm_status = ws.vm.status if hasattr(ws, 'vm') and ws.vm else 'no-vm'
            notes = ws.vm.notes if hasattr(ws, 'vm') and ws.vm else ""
            print(f'[{(i+1)*5}s] {vm_status} {notes}')
            if vm_status == 'running':
                print('SUCCESS')
                break
            if vm_status == 'error':
                print('FAILED:', notes)
                break
    except Exception as e:
        print(f"Step 4 FAILED: {e}")

if __name__ == '__main__':
    step1()
    step2()
    step3()
    step4()
