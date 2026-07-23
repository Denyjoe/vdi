from apps.vms.services.proxmox_service import (
    ProxmoxService)
import time

ps = ProxmoxService()

start = time.time()
try:
    upid = ps.proxmox.nodes(
        ps.node).qemu(9000).clone.post(
        newid=150, 
        name='speed-test-clone',
        full=1)
    print(f'Clone task started: '
        f'{upid}')
    
    # Poll every 5 seconds, report progress
    for i in range(60):  # up to 5 min
        time.sleep(5)
        status = ps.proxmox.nodes(
            ps.node).tasks(
            upid).status.get()
        elapsed = time.time() - start
        print(f'  [{elapsed:.0f}s] '
            f'Task status: '
            f'{status.get("status")}')
        if status.get('status') == 'stopped':
            print(f'  Exit status: '
                f'{status.get("exitstatus")}')
            break
except Exception as e:
    print(f'Clone failed: {str(e)}')

elapsed = time.time() - start
print(f'Total time: {elapsed:.0f}s')
