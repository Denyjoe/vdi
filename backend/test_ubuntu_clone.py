from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()
TEST_VM_ID = 999

upid = ps.proxmox.nodes(ps.node).qemu(9000).clone.post(
    newid=TEST_VM_ID, name='ubuntu-retest', full=0)
print('Clone started:', upid)

for i in range(15):
    time.sleep(3)
    status = ps.proxmox.nodes(ps.node).tasks(upid).status.get()
    if status.get('status') == 'stopped':
        print('Clone exit:', status.get('exitstatus'))
        break

ps.proxmox.nodes(ps.node).qemu(TEST_VM_ID).status.start.post()
print('VM started, waiting for network...')

for i in range(20):
    time.sleep(3)
    try:
        ip_info = ps.proxmox.nodes(ps.node).qemu(TEST_VM_ID).agent('network-get-interfaces').get()
        for iface in ip_info.get('result', []):
            for addr in iface.get('ip-addresses', []):
                if addr.get('ip-address-type') == 'ipv4' and addr.get('ip-address') != '127.0.0.1':
                    print(f'[{((i+1)*3)}s] GOT IP: {addr.get("ip-address")}')
    except Exception:
        print(f'[{((i+1)*3)}s] no IP yet')
