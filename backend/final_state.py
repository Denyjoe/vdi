from apps.vms.services.proxmox_service import ProxmoxService
ps = ProxmoxService()
vms = ps.proxmox.nodes(ps.node).qemu.get()
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(v.get('vmid'), v.get('name'), v.get('status'))
