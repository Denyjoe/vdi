import re

with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/vms/pool_views.py', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'class SystemStatsView\(APIView\):.*?except Exception as e:.*?return Response\(.*?\)', re.DOTALL)
match = pattern.search(content)

if match:
    new_class = '''class SystemStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from apps.vms.services.proxmox_service import ProxmoxService
        from apps.vms.services.guacamole_service import GuacamoleService
        from decouple import config
        
        proxmox_status = 'offline'
        proxmox_error = None
        node_info = {}
        vms_total = 0
        vms_running = 0
        
        try:
            ps = ProxmoxService()
            nodes = ps.proxmox.nodes.get()
            node_info = nodes[0] if nodes else {}
            vms = ps.proxmox.nodes(ps.node).qemu.get()
            vms_total = len(vms)
            vms_running = len([v for v in vms if v.get('status') == 'running'])
            proxmox_status = 'online'
        except Exception as e:
            proxmox_error = str(e)
            
        guac_status = 'offline'
        guac_error = None
        try:
            gs = GuacamoleService()
            gs.authenticate()
            guac_status = 'online'
        except Exception as e:
            guac_error = str(e)
            
        return Response({
            'success': True,
            'proxmox': {
                'status': proxmox_status,
                'error': proxmox_error,
                'host': config('PROXMOX_HOST', default='unknown'),
                'node': node_info.get('node', 'pve'),
                'cpu_usage': round(node_info.get('cpu', 0) * 100, 1) if node_info else 0,
                'ram_used': round(node_info.get('mem', 0) / (1024**3), 1) if node_info else 0,
                'ram_total': round(node_info.get('maxmem', 0) / (1024**3), 1) if node_info else 0,
                'uptime_seconds': node_info.get('uptime', 0) if node_info else 0,
            },
            'vms': {
                'total': vms_total,
                'running': vms_running,
            },
            'guacamole': {
                'url': config('GUACAMOLE_URL', default='unknown'),
                'status': guac_status,
                'error': guac_error
            }
        })'''
    new_content = content[:match.start()] + new_class + content[match.end():]
    with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/backend/apps/vms/pool_views.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Updated pool_views.py')
else:
    print('Could not find SystemStatsView bounds.')
