from apps.vms.services.proxmox_service import ProxmoxService
try:
    ps = ProxmoxService()
    nodes = ps.proxmox.nodes.get()
    print('Proxmox CONNECTED. Nodes:', nodes)
except Exception as e:
    print('Proxmox FAILED:', str(e))
    print('Error type:', type(e).__name__)

from apps.vms.services.guacamole_service import GuacamoleService
try:
    gs = GuacamoleService()
    gs.authenticate()
    print('Guacamole CONNECTED. Token:', gs.token[:10] + '...' if gs.token else 'No token')
except Exception as e:
    print('Guacamole FAILED:', str(e))
    print('Error type:', type(e).__name__)
