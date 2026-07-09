"""
Admin VM Pool management API views.

Provides endpoints for admin to manage the pre-cloned VM pool:
    - GET  /api/vms/admin/pool/status/      → Pool stats + all entries
    - POST /api/vms/admin/pool/create/      → Pre-clone VMs (background)
    - POST /api/vms/admin/pool/cleanup/     → Remove error VMs
    - DELETE /api/vms/admin/pool/<id>/      → Delete specific entry
    - GET  /api/vms/admin/templates/        → Templates with pool counts
    - POST /api/vms/admin/templates/<id>/link/ → Link to Proxmox template
"""

import threading
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.users.permissions import IsAdmin
from apps.vms.models import VMTemplate, VMPoolEntry
from apps.vms.services.pool_service import VMPoolService

logger = logging.getLogger(__name__)


class PoolStatusView(APIView):
    """
    GET /api/vms/admin/pool/status/

    Returns pool statistics and a list of all pool entries
    for the admin dashboard.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        """
        Return pool stats and detailed entry list.

        Returns:
            Response: JSON with 'stats' and 'entries' keys.
        """
        pool = VMPoolService()
        stats = pool.get_pool_status()

        entries = (
            VMPoolEntry.objects
            .select_related('template', 'assigned_to')
            .order_by('-created_at')
        )

        entries_data = [
            {
                'id': e.id,
                'template': e.template.name,
                'template_id': e.template.id,
                'proxmox_vmid': e.proxmox_vmid,
                'ip_address': e.ip_address,
                'status': e.status,
                'assigned_to': e.assigned_to.email if e.assigned_to else None,
                'created_at': e.created_at.isoformat(),
                'assigned_at': e.assigned_at.isoformat() if e.assigned_at else None,
            }
            for e in entries
        ]

        return Response({
            'success': True,
            'stats': stats,
            'entries': entries_data,
        })


class PoolCreateView(APIView):
    """
    POST /api/vms/admin/pool/create/

    Body: {"template_id": 1, "count": 2}

    Creates VMs in a background thread so admin doesn't wait
    for the 5–10 minute clone process.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    MAX_BATCH_SIZE = 5

    def post(self, request):
        """
        Trigger background VM creation for the pool.

        Args:
            request: Must contain template_id (int) and count (int, 1-5).

        Returns:
            Response: Confirmation with count and template name.
        """
        template_id = request.data.get('template_id')
        count = int(request.data.get('count', 1))

        if count > self.MAX_BATCH_SIZE:
            return Response(
                {'success': False, 'message': f'Max {self.MAX_BATCH_SIZE} VMs at a time'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
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

        def _create_vms():
            """Background worker to create pool VMs."""
            pool = VMPoolService()
            for i in range(count):
                logger.info("Creating pool VM %d/%d for %s", i + 1, count, template.name)
                pool.create_pool_vm(template)

        thread = threading.Thread(target=_create_vms, daemon=True)
        thread.start()

        return Response({
            'success': True,
            'message': (
                f'Creating {count} VM(s) for "{template.name}" in background. '
                f'Check pool status for progress.'
            ),
            'template': template.name,
            'count': count,
        })


class PoolCleanupView(APIView):
    """
    POST /api/vms/admin/pool/cleanup/

    Removes error VMs from pool and Proxmox.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        """
        Clean up all pool entries in error state.

        Returns:
            Response: Count of cleaned entries.
        """
        pool = VMPoolService()
        cleaned = pool.cleanup_errors()
        return Response({
            'success': True,
            'message': f'Cleaned up {cleaned} error VM(s)',
        })


class PoolDeleteEntryView(APIView):
    """
    DELETE /api/vms/admin/pool/<entry_id>/

    Delete a specific pool entry and its Proxmox VM.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, entry_id):
        """
        Delete a specific pool entry, cleaning up Proxmox and Guacamole.

        Args:
            entry_id (int): The pool entry ID to delete.

        Returns:
            Response: Confirmation message.
        """
        try:
            entry = VMPoolEntry.objects.get(id=entry_id)
        except VMPoolEntry.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Entry not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        pool = VMPoolService()

        if entry.guacamole_connection_id:
            try:
                pool.guacamole.delete_connection(entry.guacamole_connection_id)
            except Exception:
                pass

        if entry.proxmox_vmid:
            try:
                pool.proxmox.delete_vm(entry.proxmox_vmid)
            except Exception:
                pass

        entry.delete()
        return Response({'success': True, 'message': 'Pool entry deleted'})


class PoolTemplateListView(APIView):
    """
    GET /api/vms/admin/templates/

    List templates with pool counts for admin management.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        """
        Return all templates with their pool ready/assigned counts.

        Returns:
            Response: List of template data with pool stats.
        """
        templates = VMTemplate.objects.all()
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
                'storage_gb': t.storage_gb,
                'is_real': t.is_real,
                'proxmox_template_id': t.proxmox_template_id,
                'pool_ready': ready_count,
                'pool_assigned': assigned_count,
                'target_pool_size': getattr(t, 'target_pool_size', 2),
                'auto_refill_enabled': getattr(t, 'auto_refill_enabled', False),
                'has_duplicate_link': id_counts.get(t.proxmox_template_id, 0) > 1 if t.proxmox_template_id else False,
                'template_type': getattr(t, 'template_type', 'desktop'),
                'price_per_hour': getattr(t, 'price_per_hour', 0),
                'monthly_cap': getattr(t, 'monthly_cap', 0),
                'icon': getattr(t, 'icon', 'Monitor'),
                'software_list': getattr(t, 'software_list', []),
                'description': getattr(t, 'description', ''),
                'is_available': getattr(t, 'is_available', True),
            })
        return Response({'success': True, 'data': data})


class TemplateLinkView(APIView):
    """
    POST /api/vms/admin/templates/<template_id>/link/

    Body: {"proxmox_template_id": 9000}

    Link a CloudDesk template to a Proxmox template VM.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, template_id):
        """
        Link or unlink a template to a Proxmox template ID.

        Args:
            template_id (int): The CloudDesk template ID.
            request.data: Must contain proxmox_template_id (int or null).

        Returns:
            Response: Confirmation with link status.
        """
        try:
            template = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        proxmox_id = request.data.get('proxmox_template_id')

        if proxmox_id is not None:
            template.proxmox_template_id = int(proxmox_id)
            template.is_real = True
        else:
            template.proxmox_template_id = None
            template.is_real = False

        template.save()

        return Response({
            'success': True,
            'message': (
                f'Template "{template.name}" linked to '
                f'Proxmox {template.proxmox_template_id}'
            ),
            'is_real': template.is_real,
        })

class SystemStatsView(APIView):
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
        })



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


class AdminTemplateCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def post(self, request):
        from apps.vms.models import VMTemplate
        
        data = request.data
        
        template = VMTemplate.objects.create(
            name=data.get('name'),
            template_type=data.get('template_type', 'desktop'),
            os=data.get('os'),
            icon=data.get('icon', 'Monitor'),
            cpu_cores=data.get('cpu_cores'),
            ram_gb=data.get('ram_gb'),
            storage_gb=data.get('storage_gb'),
            price_per_hour=data.get('price_per_hour', 0),
            monthly_cap=data.get('monthly_cap', 0),
            software_list=data.get('software_list', []),
            description=data.get('description', ''),
            is_available=data.get('is_available', True),
            is_real=False,  # Not linked to Proxmox yet
        )
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'template_created',
            f'Created template "{template.name}"')
        
        return Response({
            'success': True,
            'id': template.id,
            'message': 'Template created. Link it to Proxmox from the table to make it available for launch.'
        })

class AdminTemplateDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def put(self, request, template_id):
        from apps.vms.models import VMTemplate
        
        try:
            t = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
            
        data = request.data
        
        if 'name' in data: t.name = data['name']
        if 'template_type' in data: t.template_type = data['template_type']
        if 'os' in data: t.os = data['os']
        if 'icon' in data: t.icon = data['icon']
        if 'cpu_cores' in data: t.cpu_cores = data['cpu_cores']
        if 'ram_gb' in data: t.ram_gb = data['ram_gb']
        if 'storage_gb' in data: t.storage_gb = data['storage_gb']
        if 'price_per_hour' in data: t.price_per_hour = data['price_per_hour']
        if 'monthly_cap' in data: t.monthly_cap = data['monthly_cap']
        if 'software_list' in data: t.software_list = data['software_list']
        if 'description' in data: t.description = data['description']
        if 'is_available' in data: t.is_available = data['is_available']
        
        t.save()
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'template_updated',
            f'Updated template "{t.name}"')
            
        return Response({
            'success': True,
            'message': 'Template updated successfully.'
        })

    def delete(self, request, template_id):
        from apps.vms.models import VMTemplate, Workspace
        
        try:
            t = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        
        active_workspaces = (
            Workspace.objects.filter(vm_template=t)
            .exclude(status='deleted').count()
        )
        
        if active_workspaces > 0:
            return Response({
                'success': False,
                'message': f'Cannot delete — {active_workspaces} workspace(s) use this template'
            }, status=400)
        
        name = t.name
        t.delete()
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'template_deleted',
            f'Deleted template "{name}"')
        
        return Response({
            'success': True,
            'message': 'Template deleted'
        })
