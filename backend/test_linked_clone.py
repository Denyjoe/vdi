from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()
start = time.time()
try:
    upid = ps.proxmox.nodes(ps.node).qemu(9000).clone.post(
        newid=160, 
        name='linked-clone-test',
        full=0)
    print('Task started:', upid)
    
    for i in range(30):
        time.sleep(3)
        status = ps.proxmox.nodes(ps.node).tasks(upid).status.get()
        elapsed = time.time() - start
        print(f'[{elapsed:.0f}s] {status.get("status")}')
        if status.get('status') == 'stopped':
            print('Exit:', status.get('exitstatus'))
            break
except Exception as e:
    print('Failed:', str(e))

print(f'Total: {time.time()-start:.0f}s')
