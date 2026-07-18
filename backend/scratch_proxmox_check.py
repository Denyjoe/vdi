from apps.vms.services.proxmox_service import ProxmoxService

ps = ProxmoxService()
vms = ps.proxmox.nodes(ps.node).qemu.get()

print('=== ALL VMs IN PROXMOX ===')
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(f"VMID: {v.get('vmid')} | Name: {v.get('name')} | Status: {v.get('status')} | Template: {v.get('template', 0)} | Disk: {round(v.get('maxdisk', 0) / (1024**3), 1)}GB")
