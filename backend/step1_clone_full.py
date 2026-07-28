from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()
NEW_ID = 9020

# First, ensure 9020 doesn't already exist from a previous failed run
try:
    ps.delete_vm_completely(NEW_ID)
except:
    pass

upid = ps.proxmox.nodes(ps.node).qemu(9000).clone.post(
    newid=NEW_ID, 
    name='ubuntu-template-fixed',
    full=1)
print('Full clone started (may take a few minutes since it is a full copy)...')

for i in range(60):
    time.sleep(5)
    status = ps.proxmox.nodes(ps.node).tasks(upid).status.get()
    if status.get('status') == 'stopped':
        print('Clone exit:', status.get('exitstatus'))
        break
    print(f'[{(i+1)*5}s] still cloning...')
