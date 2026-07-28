from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()
NEW_ID = 9021

# Delete if it already exists
try:
    ps.delete_vm_completely(NEW_ID)
except:
    pass

print('Cloning 9020 to 9021 (full clone)...')
upid = ps.proxmox.nodes(ps.node).qemu(9020).clone.post(
    newid=NEW_ID, 
    name='ubuntu-template-dbus-fix',
    full=1)

for i in range(60):
    time.sleep(5)
    status = ps.proxmox.nodes(ps.node).tasks(upid).status.get()
    if status.get('status') == 'stopped':
        print('Clone exit:', status.get('exitstatus'))
        break

print('Starting clone 9021...')
ps.proxmox.nodes(ps.node).qemu(NEW_ID).status.start.post()

print('Waiting for network (30s)...')
for i in range(15):
    time.sleep(3)
    try:
        ip_info = ps.proxmox.nodes(ps.node).qemu(NEW_ID).agent('network-get-interfaces').get()
        got_ip = None
        for iface in ip_info.get('result', []):
            for addr in iface.get('ip-addresses', []):
                if addr.get('ip-address-type') == 'ipv4' and addr.get('ip-address') != '127.0.0.1':
                    got_ip = addr.get('ip-address')
                    print(f'[{(i+1)*3}s] GOT IP: {got_ip}')
        if got_ip:
            break
    except Exception:
        pass

print('Done.')
