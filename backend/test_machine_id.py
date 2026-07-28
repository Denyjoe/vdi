from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()
TEST_ID = 998

upid = ps.proxmox.nodes(ps.node).qemu(9000).clone.post(
    newid=TEST_ID, name='machine-id-check', full=0)
print('Clone started')

for i in range(15):
    time.sleep(3)
    status = ps.proxmox.nodes(ps.node).tasks(upid).status.get()
    if status.get('status') == 'stopped':
        break

ps.proxmox.nodes(ps.node).qemu(TEST_ID).status.start.post()
print('Started, waiting 15s for boot...')
time.sleep(15)

try:
    res = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent.exec.post(
        command=['cat', '/etc/machine-id'])
    pid = res.get('pid')
    time.sleep(2)
    out = ps.proxmox.nodes(ps.node).qemu(TEST_ID).agent('exec-status').get(pid=pid)
    print('machine-id content:', out.get('out-data', 'NO OUTPUT'))
except Exception as e:
    print('Could not check via agent:', str(e))
