from apps.vms.services.proxmox_service import ProxmoxService
import time

ps = ProxmoxService()

for i in range(20):
    time.sleep(5)
    try:
        ip_info = ps.proxmox.nodes(ps.node).qemu(9022).agent('network-get-interfaces').get()
        for iface in ip_info.get('result', []):
            for addr in iface.get('ip-addresses', []):
                if addr.get('ip-address-type') == 'ipv4' and addr.get('ip-address') != '127.0.0.1':
                    print(f'[{(i+1)*5}s] IP: {addr.get("ip-address")}')
    except Exception as e:
        print(f'[{(i+1)*5}s] not ready yet')
