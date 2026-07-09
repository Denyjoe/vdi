from rest_framework import views, status, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import VMTemplate
from .serializers import VMTemplateSerializer

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')

class AdminTemplatePricingView(views.APIView):
    permission_classes = [IsAdminUser]

    def put(self, request, pk):
        template = get_object_or_404(VMTemplate, pk=pk)
        
        if 'price_per_hour' in request.data:
            template.price_per_hour = request.data['price_per_hour']
        if 'monthly_cap' in request.data:
            template.monthly_cap = request.data['monthly_cap']
        if 'is_available' in request.data:
            template.is_available = request.data['is_available']
            
        template.save()
        
        return Response({
            "success": True,
            "data": VMTemplateSerializer(template).data,
            "message": "Template pricing updated"
        })

class AdminWorkspacesListView(views.APIView):
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        from apps.vms.models import Workspace
        from django.db.models import Q
        
        search = request.query_params.get('search', '')
        status_filter = request.query_params.get('status', 'all')
        sort = request.query_params.get('sort', '-created_at')
        
        workspaces = Workspace.objects.select_related('owner', 'vm_template', 'vm')
        
        if search:
            workspaces = workspaces.filter(
                Q(name__icontains=search) |
                Q(owner__email__icontains=search) |
                Q(owner__first_name__icontains=search)
            )
        
        if status_filter != 'all':
            workspaces = workspaces.filter(status=status_filter)
        
        workspaces = workspaces.order_by(sort)
        
        results = []
        for ws in workspaces:
            results.append({
                'id': ws.id,
                'name': ws.name,
                'status': ws.status,
                'owner_name': f'{ws.owner.first_name} {ws.owner.last_name}' if ws.owner else 'Unknown',
                'owner_email': ws.owner.email if ws.owner else '',
                'template_name': ws.vm_template.name if ws.vm_template else 'Unknown',
                'template_specs': f'{ws.vm_template.cpu_cores} vCPU · {ws.vm_template.ram_gb}GB' if ws.vm_template else '',
                'ip_address': getattr(ws.vm, 'ip_address', None) if ws.vm else None,
                'created_at': ws.created_at.isoformat() if hasattr(ws, 'created_at') else None,
            })
        
        return Response({
            'workspaces': results,
            'total': len(results),
            'counts': {
                'all': Workspace.objects.count(),
                'running': Workspace.objects.filter(status__in=['active', 'running']).count(),
                'stopped': Workspace.objects.filter(status='stopped').count(),
                'error': Workspace.objects.filter(status='error').count(),
                'provisioning': Workspace.objects.filter(status='provisioning').count(),
            }
        })

class AdminForceStopWorkspaceView(views.APIView):
    permission_classes = [IsAdminUser]
    
    def post(self, request, workspace_id):
        try:
            from apps.vms.models import Workspace
            from apps.vms.services.pool_service import VMPoolService
            
            ws = Workspace.objects.get(id=workspace_id)
            
            if ws.vm:
                pool = VMPoolService()
                try:
                    pool.release_vm(ws.vm)
                except Exception:
                    pass
            
            ws.status = 'stopped'
            ws.save()
            
            from apps.users.admin_services import log_admin_action
            log_admin_action(
                request.user, 
                'vm_stopped',
                f'Force stopped workspace "{ws.name}" (owner: {ws.owner.email if ws.owner else "unknown"})',
                target_type='workspace',
                target_id=ws.id
            )
            
            return Response({'success': True, 'message': 'Workspace stopped'})
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)

class AdminDeleteWorkspaceView(views.APIView):
    permission_classes = [IsAdminUser]
    
    def delete(self, request, workspace_id):
        try:
            from apps.vms.models import Workspace
            from apps.vms.services.pool_service import VMPoolService
            
            ws = Workspace.objects.get(id=workspace_id)
            
            if ws.vm and ws.status in ['active', 'running']:
                pool = VMPoolService()
                try:
                    pool.release_vm(ws.vm)
                except Exception:
                    pass
            
            name = ws.name
            owner_email = ws.owner.email if ws.owner else 'unknown'
            ws.delete()
            
            from apps.users.admin_services import log_admin_action
            log_admin_action(
                request.user, 
                'vm_stopped',
                f'Deleted workspace "{name}" (owner: {owner_email})',
                target_type='workspace',
                target_id=workspace_id
            )
            
            return Response({'success': True, 'message': 'Workspace deleted'})
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)

class AdminBulkWorkspaceView(views.APIView):
    permission_classes = [IsAdminUser]
    
    def post(self, request):
        from apps.vms.models import Workspace
        from apps.vms.services.pool_service import VMPoolService
        
        workspace_ids = request.data.get('workspace_ids', [])
        action = request.data.get('action')
        
        if not workspace_ids or not action:
            return Response({'success': False, 'message': 'workspace_ids and action required'}, status=400)
        
        pool = VMPoolService()
        count = 0
        
        workspaces = Workspace.objects.filter(id__in=workspace_ids)
        
        if action == 'stop':
            for ws in workspaces:
                if ws.vm:
                    try:
                        pool.release_vm(ws.vm)
                    except Exception:
                        pass
                ws.status = 'stopped'
                ws.save()
                count += 1
        elif action == 'delete':
            for ws in workspaces:
                if ws.vm and ws.status in ['active', 'running']:
                    try:
                        pool.release_vm(ws.vm)
                    except Exception:
                        pass
                ws.delete()
                count += 1
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'vm_stopped',
            f'Bulk {action} applied to {count} workspace(s)'
        )
        
        return Response({'success': True, 'message': f'{action} applied to {count} workspace(s)'})

class AdminWorkspaceDetailView(views.APIView):
    permission_classes = [IsAdminUser]
    
    def get(self, request, workspace_id):
        from apps.vms.models import Workspace
        
        try:
            ws = Workspace.objects.select_related('owner', 'vm_template', 'vm').get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        
        live_stats = None
        if ws.vm and ws.status in ['active', 'running']:
            try:
                from apps.vms.services.proxmox_service import ProxmoxService
                ps = ProxmoxService()
                vmid = getattr(ws.vm, 'proxmox_vm_id', None)
                if vmid:
                    status = ps.proxmox.nodes(ps.node).qemu(vmid).status.current.get()
                    live_stats = {
                        'cpu_usage': round(status.get('cpu', 0) * 100, 1),
                        'ram_used_mb': round(status.get('mem', 0) / (1024**2)),
                        'ram_total_mb': round(status.get('maxmem', 0) / (1024**2)),
                        'uptime_seconds': status.get('uptime', 0),
                    }
            except Exception:
                pass
        
        return Response({
            'id': ws.id,
            'name': ws.name,
            'status': ws.status,
            'owner': {
                'name': f'{ws.owner.first_name} {ws.owner.last_name}' if ws.owner else 'Unknown',
                'email': ws.owner.email if ws.owner else '',
                'id': ws.owner.id if ws.owner else None,
            },
            'template': {
                'name': ws.vm_template.name if ws.vm_template else 'Unknown',
                'cpu_cores': ws.vm_template.cpu_cores if ws.vm_template else 0,
                'ram_gb': ws.vm_template.ram_gb if ws.vm_template else 0,
                'storage_gb': ws.vm_template.storage_gb if ws.vm_template else 0,
            },
            'vm': {
                'ip_address': getattr(ws.vm, 'ip_address', None) if ws.vm else None,
                'proxmox_vm_id': getattr(ws.vm, 'proxmox_vm_id', None) if ws.vm else None,
            },
            'live_stats': live_stats,
            'created_at': ws.created_at.isoformat() if hasattr(ws, 'created_at') else None,
        })
