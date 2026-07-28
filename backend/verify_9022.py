from apps.vms.services.proxmox_service import ProxmoxService

ps = ProxmoxService()
config = ps.proxmox.nodes(ps.node).qemu(9022).config.get()
print('Is template:', config.get('template', 0))
print('Agent setting:', config.get('agent', 'NOT SET'))
print('ide2 (should be gone):', config.get('ide2', 'REMOVED - confirmed'))
