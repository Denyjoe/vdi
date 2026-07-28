from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()
TEST_ID = 998

print('Cloning Ubuntu template 9000...')
upid = ps.proxmox.nodes(ps.node).qemu(9000).clone.post(
    newid=TEST_ID, name='machine-id-check', full=0)

for i in range(15):
    time.sleep(3)
    status = ps.proxmox.nodes(ps.node).tasks(upid).status.get()
    if status.get('status') == 'stopped':
        break

print('Removing missing CDROM from clone...')
try:
    ps.proxmox.nodes(ps.node).qemu(TEST_ID).config.post(delete='ide2')
except Exception as e:
    print('Failed to remove cdrom:', e)

print('Starting VM...')
ps.proxmox.nodes(ps.node).qemu(TEST_ID).status.start.post()

print('Waiting 15s for boot...')
time.sleep(15)

try:
    res = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent.exec.post(
        command=['cat', '/etc/machine-id'])
    pid = res.get('pid')
    time.sleep(2)
    out = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent('exec-status').get(pid=pid)
    print('machine-id content:', out.get('out-data', 'NO OUTPUT').strip())
except Exception as e:
    print('Could not check via agent:', str(e))

print('Checking IP address...')
try:
    ip_info = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent('network-get-interfaces').get()
    found = False
    for iface in ip_info.get('result', []):
        for addr in iface.get('ip-addresses', []):
            if addr.get('ip-address-type') == 'ipv4' and addr.get('ip-address') != '127.0.0.1':
                print('GOT IP:', addr.get('ip-address'))
                found = True
    if not found:
        print('No IP address found on interfaces.')
except Exception as e:
    print('Error getting IP:', str(e))

print('Cleaning up...')
ps.delete_vm_completely(TEST_ID)
print('Done.')
