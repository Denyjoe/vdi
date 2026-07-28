import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.vms.services.proxmox_service import ProxmoxService
ps = ProxmoxService()
try:
    net = ps.proxmox.nodes(ps.node).qemu(200).agent.get('network-get-interfaces')
    for iface in net.get('result', []):
        for ip in iface.get('ip-addresses', []):
            print(f"{iface.get('name')}: {ip.get('ip-address')}")
except Exception as e:
    print('Failed to get IP:', e)
