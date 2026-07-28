from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()
TEST_ID = 997

print('Cloning Zorin template 9010...')
upid = ps.proxmox.nodes(ps.node).qemu(9010).clone.post(
    newid=TEST_ID, name='zorin-network-test', full=0)

for i in range(15):
    time.sleep(3)
    status = ps.proxmox.nodes(ps.node).tasks(upid).status.get()
    if status.get('status') == 'stopped':
        break

print('Starting Zorin VM...')
ps.proxmox.nodes(ps.node).qemu(TEST_ID).status.start.post()

print('Waiting for network...')
for i in range(20):
    time.sleep(3)
    try:
        ip_info = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent('network-get-interfaces').get()
        found = False
        for iface in ip_info.get('result', []):
            for addr in iface.get('ip-addresses', []):
                if addr.get('ip-address-type') == 'ipv4' and addr.get('ip-address') != '127.0.0.1':
                    print(f'[{(i+1)*3}s] GOT IP: {addr.get("ip-address")}')
                    found = True
        if found:
            break
    except Exception as e:
        print(f'[{(i+1)*3}s] no IP yet ({str(e)})')

try:
    res = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent.exec.post(
        command=['cat', '/etc/machine-id'])
    pid = res.get('pid')
    time.sleep(2)
    out = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent('exec-status').get(pid=pid)
    print('Zorin machine-id content:', out.get('out-data', 'NO OUTPUT').strip())
except Exception as e:
    print('Could not check via agent:', str(e))

ps.delete_vm_completely(TEST_ID)
print('Zorin test cleaned up.')
