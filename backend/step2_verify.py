from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()
TEST_ID = 995

print('Cloning 9020...')
upid = ps.proxmox.nodes(ps.node).qemu(9020).clone.post(
    newid=TEST_ID, 
    name='ubuntu-9020-final-verify',
    full=0)

for i in range(15):
    time.sleep(3)
    status = ps.proxmox.nodes(ps.node).tasks(upid).status.get()
    if status.get('status') == 'stopped':
        print('Clone exit:', status.get('exitstatus'))
        break

print('Starting clone...')
ps.proxmox.nodes(ps.node).qemu(TEST_ID).status.start.post()

got_ip = None
for i in range(15):
    time.sleep(3)
    try:
        ip_info = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent('network-get-interfaces').get()
        for iface in ip_info.get('result', []):
            for addr in iface.get('ip-addresses', []):
                if addr.get('ip-address-type') == 'ipv4' and addr.get('ip-address') != '127.0.0.1':
                    got_ip = addr.get('ip-address')
                    print(f'[{(i+1)*3}s] GOT IP: {got_ip}')
        if got_ip:
            break
    except Exception:
        print(f'[{(i+1)*3}s] no IP yet')

if got_ip:
    try:
        res = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent.exec.post(
            command=['cat', '/etc/machine-id'])
        pid = res.get('pid')
        time.sleep(2)
        out = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent('exec-status').get(pid=pid)
        print('machine-id on clone:', repr(out.get('out-data', '')))
    except Exception as e:
        print('Check failed:', str(e))

ps.delete_vm_completely(TEST_ID)
print('Test cleaned up')
