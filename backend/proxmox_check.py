from apps.vms.services.proxmox_service import ProxmoxService
ps = ProxmoxService()

print('=== VM LIST ===')
vms = ps.proxmox.nodes(ps.node).qemu.get()
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(v.get('vmid'), v.get('name'), v.get('status'), v.get('lock', 'no-lock'))

print()
print('=== STORAGE ===')
storage = ps.proxmox.nodes(ps.node).storage('local-lvm').status.get()
used_gb = round(storage['used'] / (1024**3), 1)
total_gb = round(storage['total'] / (1024**3), 1)
print(f'{used_gb}GB used / {total_gb}GB total')
