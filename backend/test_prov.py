import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.vms.services.proxmox_service import ProxmoxService

print("Testing ProxmoxService...")
try:
    service = ProxmoxService()
    nodes = service.proxmox.nodes.get()
    print("SUCCESS! ProxmoxService connected using the backend .env credentials.")
    print("Nodes found:", [n['node'] for n in nodes])
except Exception as e:
    import traceback
    print("FAILED:", str(e))
    traceback.print_exc()
