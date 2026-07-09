import re

with open('apps/vms/pool_views.py', 'r') as f:
    code = f.read()

# 1. Update PoolTemplateListView.get
old_get = '''        templates = VMTemplate.objects.all()
        data = []
        for t in templates:
            ready_count = VMPoolEntry.objects.filter(template=t, status='ready').count()
            assigned_count = VMPoolEntry.objects.filter(template=t, status='assigned').count()
            data.append({
                'id': t.id,
                'name': t.name,
                'os': t.os,
                'cpu_cores': t.cpu_cores,
                'ram_gb': t.ram_gb,
                'is_real': t.is_real,
                'proxmox_template_id': t.proxmox_template_id,
                'pool_ready': ready_count,
                'pool_assigned': assigned_count,
            })
        return Response({'success': True, 'data': data})'''

new_get = '''        templates = VMTemplate.objects.all()
        from collections import Counter
        real_templates = [t for t in templates if t.is_real and t.proxmox_template_id]
        id_counts = Counter(t.proxmox_template_id for t in real_templates)
        data = []
        for t in templates:
            ready_count = VMPoolEntry.objects.filter(template=t, status='ready').count()
            assigned_count = VMPoolEntry.objects.filter(template=t, status='assigned').count()
            data.append({
                'id': t.id,
                'name': t.name,
                'os': t.os,
                'cpu_cores': t.cpu_cores,
                'ram_gb': t.ram_gb,
                'is_real': t.is_real,
                'proxmox_template_id': t.proxmox_template_id,
                'pool_ready': ready_count,
                'pool_assigned': assigned_count,
                'target_pool_size': getattr(t, 'target_pool_size', 2),
                'auto_refill_enabled': getattr(t, 'auto_refill_enabled', False),
                'has_duplicate_link': id_counts.get(t.proxmox_template_id, 0) > 1 if t.proxmox_template_id else False,
            })
        return Response({'success': True, 'data': data})'''

code = code.replace(old_get, new_get)

# 2. Update PoolCreateView.post
old_create = '''        try:
            template = VMTemplate.objects.get(id=template_id, is_real=True)
        except VMTemplate.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Real template not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        def _create_vms():'''

new_create = '''        try:
            template = VMTemplate.objects.get(id=template_id, is_real=True)
        except VMTemplate.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Real template not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Capacity check
        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            ps = ProxmoxService()
            node_status = ps.proxmox.nodes(ps.node).status.get()
            free_mem_gb = round((node_status['memory']['total'] - node_status['memory']['used']) / (1024**3), 1)
            
            needed_gb = template.ram_gb * count
            if needed_gb > free_mem_gb:
                return Response({
                    'success': False,
                    'message': f'Insufficient RAM: need {needed_gb}GB, only {free_mem_gb}GB free. Reduce count or free up resources.'
                }, status=400)
        except Exception:
            pass
            
        from django.utils import timezone
        template.last_pool_refresh = timezone.now()
        template.save(update_fields=['last_pool_refresh'])
        
        try:
            from apps.users.admin_services import log_admin_action
            log_admin_action(request.user, 'backup_triggered', f'Pre-cloned {count} VM(s) for {template.name}')
        except Exception:
            pass

        def _create_vms():'''

code = code.replace(old_create, new_create)

# 3. Append new views
new_views = '''

class PoolEntriesView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from apps.vms.models import VMPoolEntry
        
        entries = VMPoolEntry.objects.select_related('template', 'assigned_vm', 'assigned_to').order_by('-created_at')
        
        return Response({
            'entries': [{
                'id': e.id,
                'vm_id': getattr(e.assigned_vm, 'proxmox_vm_id', e.proxmox_vmid) if e.assigned_vm else e.proxmox_vmid,
                'template_name': e.template.name if e.template else 'Unknown',
                'status': e.status,
                'created_at': e.created_at.isoformat() if e.created_at else None,
                'assigned_to': (f'{e.assigned_to.first_name} {e.assigned_to.last_name}' if e.assigned_to else None),
                'ip_address': getattr(e.assigned_vm, 'ip_address', e.ip_address) if e.assigned_vm else e.ip_address,
            } for e in entries]
        })

class PoolCapacityView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            ps = ProxmoxService()
            
            node_status = ps.proxmox.nodes(ps.node).status.get()
            
            total_mem_gb = round(node_status['memory']['total'] / (1024**3), 1)
            used_mem_gb = round(node_status['memory']['used'] / (1024**3), 1)
            free_mem_gb = round(total_mem_gb - used_mem_gb, 1)
            
            # Note: storage call uses the proper syntax for python proxmoxer
            try:
                storage_info = ps.proxmox.nodes(ps.node).storage('local-lvm').status.get()
                free_storage_gb = round((storage_info['total'] - storage_info['used']) / (1024**3), 1)
            except Exception:
                free_storage_gb = 50.0  # Fallback if local-lvm doesn't exist
            
            return Response({
                'total_ram_gb': total_mem_gb,
                'used_ram_gb': used_mem_gb,
                'free_ram_gb': free_mem_gb,
                'free_storage_gb': free_storage_gb,
                'can_clone': free_mem_gb > 1 and free_storage_gb > 10,
            })
        except Exception as e:
            return Response({
                'error': str(e),
                'can_clone': False,
            }, status=200)

class PoolConfigView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def put(self, request, template_id):
        from apps.vms.models import VMTemplate
        t = VMTemplate.objects.get(id=template_id)
        
        if 'target_pool_size' in request.data:
            t.target_pool_size = int(request.data['target_pool_size'])
        if 'auto_refill_enabled' in request.data:
            t.auto_refill_enabled = bool(request.data['auto_refill_enabled'])
        t.save()
        
        return Response({
            'success': True,
            'message': 'Pool config updated'
        })

class TemplateTestLinkView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def post(self, request, template_id):
        proxmox_vm_id = request.data.get('proxmox_vm_id')
        
        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            ps = ProxmoxService()
            
            vm_config = ps.proxmox.nodes(ps.node).qemu(proxmox_vm_id).config.get()
            vm_status = ps.proxmox.nodes(ps.node).qemu(proxmox_vm_id).status.current.get()
            
            is_template = vm_config.get('template', 0) == 1
            
            return Response({
                'success': True,
                'exists': True,
                'is_template': is_template,
                'name': vm_config.get('name', 'Unknown'),
                'cores': vm_config.get('cores', 0),
                'memory_mb': vm_config.get('memory', 0),
                'status': vm_status.get('status'),
                'warning': (None if is_template else 'This VM is NOT marked as a Proxmox template. Convert it to a template first.')
            })
        except Exception as e:
            return Response({
                'success': False,
                'exists': False,
                'message': f'Cannot find VM {proxmox_vm_id}: {str(e)}'
            })

class TemplatePreviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def post(self, request, template_id):
        proxmox_vm_id = request.data.get('proxmox_vm_id')
        
        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            from apps.vms.services.guacamole_service import GuacamoleService
            import random
            
            ps = ProxmoxService()
            preview_vmid = 8900 + random.randint(1, 99)
            
            task = ps.proxmox.nodes(ps.node).qemu(proxmox_vm_id).clone.post(
                newid=preview_vmid,
                name=f'preview-{preview_vmid}',
                full=1)
            
            import time
            for _ in range(30):
                status = ps.proxmox.nodes(ps.node).tasks(task).status.get()
                if status['status'] == 'stopped':
                    break
                time.sleep(2)
            
            ps.proxmox.nodes(ps.node).qemu(preview_vmid).status.start.post()
            time.sleep(5)
            
            gs = GuacamoleService()
            conn_id = gs.create_connection(
                name=f'preview-{preview_vmid}',
                hostname='pending',  
                username='student',
                password='student123')
            
            return Response({
                'success': True,
                'preview_vmid': preview_vmid,
                'connection_id': conn_id,
                'message': 'Preview VM starting. This may take 30-60 seconds to be ready.'
            })
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=500)

class TemplatePreviewCleanupView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def post(self, request, template_id):
        preview_vmid = request.data.get('preview_vmid')
        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            ps = ProxmoxService()
            ps.proxmox.nodes(ps.node).qemu(preview_vmid).status.stop.post()
            import time
            time.sleep(2)
            ps.proxmox.nodes(ps.node).qemu(preview_vmid).delete()
            return Response({'success': True})
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)
'''

with open('apps/vms/pool_views.py', 'w') as f:
    f.write(code + new_views)
