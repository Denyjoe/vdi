from apps.vms.services.proxmox_service import ProxmoxService

ps = ProxmoxService()

print('=== RECENT PROXMOX TASKS ===')
tasks = ps.proxmox.nodes(ps.node).tasks.get(limit=10)
for t in tasks:
    print(
        t.get('type'),
        t.get('status'),
        t.get('id'),
        t.get('exitstatus', 'N/A')
    )

print()
print('=== CURRENT VM LIST ===')
vms = ps.proxmox.nodes(ps.node).qemu.get()
for v in sorted(vms, key=lambda x: x.get('vmid', 0)):
    print(v.get('vmid'), v.get('name'), v.get('status'))
