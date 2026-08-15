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
        if 'price_per_month' in request.data:
            template.price_per_month = request.data['price_per_month']
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

class AdminRunIdleCheckView(views.APIView):
    """Manual trigger for the idle-workspace warning/deletion sweep —
    the same function CELERY_BEAT_SCHEDULE calls at 3am daily. Genuinely
    useful for real ops (run it on demand) and the only way to demonstrate
    this feature firing live without waiting for the scheduled time."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        from apps.vms.services.idle_cleanup_service import check_and_process_idle_workspaces
        result = check_and_process_idle_workspaces()
        return Response({"success": True, "data": result})


class AdminIdleWorkspacesSummaryView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta
        from apps.users.models import SystemConfig
        from .models import Workspace

        now = timezone.now()
        warning_days = int(SystemConfig.get('workspace_idle_warning_days', '23'))
        final_warning_days = int(SystemConfig.get('workspace_idle_final_warning_days', '29'))
        deletion_days = int(SystemConfig.get('workspace_idle_deletion_days', '30'))

        warning_cutoff = now - timedelta(days=warning_days)
        final_cutoff = now - timedelta(days=final_warning_days)
        delete_cutoff = now - timedelta(days=deletion_days)

        active_workspaces = Workspace.objects.filter(status__in=['active', 'stopped'])

        past_deletion_threshold = active_workspaces.filter(last_accessed_at__lte=delete_cutoff)
        final_warning_stage = active_workspaces.filter(
            last_accessed_at__lte=final_cutoff, last_accessed_at__gt=delete_cutoff
        )
        first_warning_stage = active_workspaces.filter(
            last_accessed_at__lte=warning_cutoff, last_accessed_at__gt=final_cutoff
        )
        healthy = active_workspaces.filter(last_accessed_at__gt=warning_cutoff)

        # Real disk usage per stage, from Proxmox itself — not estimated.
        def stage_disk_gb(qs):
            from apps.vms.services.proxmox_service import get_proxmox_service
            total_bytes = 0
            try:
                ps = get_proxmox_service()
                for ws in qs.select_related('vm'):
                    if not ws.vm or not ws.vm.proxmox_vm_id:
                        continue
                    try:
                        status = ps.proxmox.nodes(ps.node).qemu(ws.vm.proxmox_vm_id).status.current.get()
                        total_bytes += status.get('maxdisk', 0) or 0
                    except Exception:
                        continue
            except Exception:
                return None
            return round(total_bytes / (1024 ** 3), 1)

        return Response({
            "success": True,
            "data": {
                "healthy": {"count": healthy.count(), "disk_gb": stage_disk_gb(healthy)},
                "first_warning": {"count": first_warning_stage.count(), "disk_gb": stage_disk_gb(first_warning_stage)},
                "final_warning": {"count": final_warning_stage.count(), "disk_gb": stage_disk_gb(final_warning_stage)},
                "past_deletion_threshold": {"count": past_deletion_threshold.count(), "disk_gb": stage_disk_gb(past_deletion_threshold)},
                "thresholds": {
                    "warning_days": warning_days,
                    "final_warning_days": final_warning_days,
                    "deletion_days": deletion_days,
                },
            }
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
            from apps.vms.workspace_views import _perform_stop

            ws = Workspace.objects.get(id=workspace_id)

            if ws.status == 'active' and ws.vm:
                # Reuses the exact same stop+deduct path as a user-initiated
                # stop, attributed to the workspace owner (not this admin),
                # so hours-balance deduction is identical regardless of who
                # or what actually stopped it.
                _perform_stop(ws)
            else:
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
    """Admin endpoint to delete a workspace with full infrastructure cleanup."""
    permission_classes = [IsAdminUser]
    
    def delete(self, request, workspace_id):
        try:
            from apps.vms.models import Workspace, VirtualMachine
            
            ws = Workspace.objects.get(id=workspace_id)
            
            # 1. Delete Guacamole connection
            if ws.vm and getattr(ws.vm, 'guacamole_connection_id', None):
                try:
                    from apps.vms.services.guacamole_service import GuacamoleService
                    gs = GuacamoleService()
                    gs.authenticate()
                    gs.delete_connection(ws.vm.guacamole_connection_id)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(
                        f'Admin delete: failed to delete Guacamole '
                        f'connection {ws.vm.guacamole_connection_id}: {e}',
                        exc_info=True)
            
            # 2. Stop and destroy the actual Proxmox VM
            if ws.vm and getattr(ws.vm, 'proxmox_vm_id', None):
                try:
                    from apps.vms.services.proxmox_service import ProxmoxService
                    ps = ProxmoxService()
                    ps.delete_vm_completely(ws.vm.proxmox_vm_id)
                except Exception as e:
                    error_str = str(e).lower()
                    if 'does not exist' not in error_str:
                        import logging
                        logging.getLogger(__name__).error(
                            f'Admin delete: failed to delete Proxmox VM '
                            f'{ws.vm.proxmox_vm_id}: {e}', exc_info=True)
                        return Response({
                            'success': False,
                            'message': (
                                f'Failed to delete VM from infrastructure: '
                                f'{str(e)}. Please try again or contact support.'
                            )
                        }, status=500)
            
            # 3. Delete DB records
            name = ws.name
            owner_email = ws.owner.email if ws.owner else 'unknown'
            vm_id = ws.vm.id if ws.vm else None
            ws.delete()
            if vm_id:
                VirtualMachine.objects.filter(id=vm_id).delete()
            
            from apps.users.admin_services import log_admin_action
            log_admin_action(
                request.user, 
                'workspace_deleted',
                f'Deleted workspace "{name}" (owner: {owner_email})',
                target_type='workspace',
                target_id=workspace_id
            )
            
            return Response({'success': True, 'message': 'Workspace permanently deleted'})
        except Workspace.DoesNotExist:
            return Response({'success': False, 'message': 'Workspace not found'}, status=404)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)

class AdminBulkWorkspaceView(views.APIView):
    """Admin endpoint for bulk workspace operations with full infrastructure cleanup."""
    permission_classes = [IsAdminUser]
    
    def post(self, request):
        from apps.vms.models import Workspace, VirtualMachine
        
        workspace_ids = request.data.get('workspace_ids', [])
        action = request.data.get('action')
        
        if not workspace_ids or not action:
            return Response({'success': False, 'message': 'workspace_ids and action required'}, status=400)
        
        count = 0
        errors = []
        
        workspaces = Workspace.objects.filter(id__in=workspace_ids)
        
        if action == 'stop':
            for ws in workspaces:
                if ws.vm and getattr(ws.vm, 'proxmox_vm_id', None):
                    try:
                        from apps.vms.services.proxmox_service import ProxmoxService
                        ps = ProxmoxService()
                        ps.proxmox.nodes(ps.node).qemu(ws.vm.proxmox_vm_id).status.stop.post()
                    except Exception as e:
                        errors.append(f'VM {ws.vm.proxmox_vm_id}: {e}')
                ws.status = 'stopped'
                ws.save()
                count += 1
        elif action == 'delete':
            for ws in workspaces:
                # 1. Delete Guacamole connection
                if ws.vm and getattr(ws.vm, 'guacamole_connection_id', None):
                    try:
                        from apps.vms.services.guacamole_service import GuacamoleService
                        gs = GuacamoleService()
                        gs.authenticate()
                        gs.delete_connection(ws.vm.guacamole_connection_id)
                    except Exception as e:
                        errors.append(f'Guacamole {ws.vm.guacamole_connection_id}: {e}')
                
                # 2. Delete Proxmox VM
                if ws.vm and getattr(ws.vm, 'proxmox_vm_id', None):
                    try:
                        from apps.vms.services.proxmox_service import ProxmoxService
                        ps = ProxmoxService()
                        ps.delete_vm_completely(ws.vm.proxmox_vm_id)
                    except Exception as e:
                        errors.append(f'Proxmox VM {ws.vm.proxmox_vm_id}: {e}')
                
                # 3. Delete DB records
                vm_id = ws.vm.id if ws.vm else None
                ws.delete()
                if vm_id:
                    VirtualMachine.objects.filter(id=vm_id).delete()
                count += 1
        
        if errors:
            import logging
            logging.getLogger(__name__).warning(
                f'Bulk {action} had partial errors: {errors}')
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(
            request.user, 
            'workspace_deleted' if action == 'delete' else 'vm_stopped',
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

class AdminHardwareView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.vms.models import Workspace

        total_vms = Workspace.objects.exclude(status='deleted').count()
        running_vms = Workspace.objects.filter(status__in=['active', 'running']).count()
        stopped_vms = Workspace.objects.filter(status='stopped').count()
        provisioning_vms = Workspace.objects.filter(status='provisioning').count()

        # This used to be 100% fabricated (hardcoded 32GB RAM, random
        # cpu/network numbers, fake storage pool sizes) — confirmed by
        # direct testing that it contradicted the REAL Proxmox capacity
        # shown elsewhere in the admin UI (VM Pool's 7.7GB vs this page's
        # fake 32GB). Every number below now comes from a live Proxmox
        # API call; if that call fails, we say so honestly instead of
        # falling back to made-up numbers.
        try:
            from apps.vms.services.proxmox_service import get_proxmox_service
            ps = get_proxmox_service()
            node_status = ps.proxmox.nodes(ps.node).status.get()
            storages = ps.proxmox.nodes(ps.node).storage.get()

            # Instantaneous throughput isn't in the status endpoint — the
            # most recent RRD (round-robin database) sample has it, same
            # source Proxmox's own UI graphs use.
            bytes_in, bytes_out = 0, 0
            try:
                rrd = ps.proxmox.nodes(ps.node).rrddata.get(timeframe='hour')
                if rrd:
                    latest = rrd[-1]
                    bytes_in = round(latest.get('netin') or 0)
                    bytes_out = round(latest.get('netout') or 0)
            except Exception:
                pass

            mem = node_status.get('memory', {})
            ram_total_gb = round(mem.get('total', 0) / (1024**3), 1)
            ram_used_gb = round(mem.get('used', 0) / (1024**3), 1)
            ram_percent = round((mem.get('used', 0) / mem['total']) * 100, 1) if mem.get('total') else 0
            cpu_percent = round(node_status.get('cpu', 0) * 100, 1)

            storage_pools = [{
                "name": s.get('storage'),
                "type": s.get('type'),
                "used_gb": round(s.get('used', 0) / (1024**3), 1),
                "total_gb": round(s.get('total', 0) / (1024**3), 1),
            } for s in storages if s.get('total')]

            data = {
                "proxmox_version": node_status.get('pveversion', 'unknown'),
                "uptime_days": round(node_status.get('uptime', 0) / 86400, 1),
                "cpu_percent": cpu_percent,
                "ram_percent": ram_percent,
                "ram_used_gb": ram_used_gb,
                "ram_total_gb": ram_total_gb,
                "network": {
                    "interface": "vmbr0",
                    "bytes_in_per_sec": bytes_in,
                    "bytes_out_per_sec": bytes_out,
                },
                "vm_summary": {
                    "total": total_vms,
                    "running": running_vms,
                    "stopped": stopped_vms,
                    "provisioning": provisioning_vms,
                },
                "nodes": [{
                    "name": ps.node,
                    "status": "online",
                    "cpu_percent": cpu_percent,
                    "ram_percent": ram_percent,
                    "vm_count": total_vms,
                }],
                "storage_pools": storage_pools,
            }
            return Response({"success": True, "data": data})
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f'AdminHardwareView: Proxmox query failed: {e}', exc_info=True)
            return Response({
                "success": False,
                "message": f"Could not reach Proxmox: {str(e)}",
                "data": {
                    "proxmox_version": "unreachable",
                    "uptime_days": 0,
                    "cpu_percent": 0,
                    "ram_percent": 0,
                    "ram_used_gb": 0,
                    "ram_total_gb": 0,
                    "network": {"interface": "vmbr0", "bytes_in_per_sec": 0, "bytes_out_per_sec": 0},
                    "vm_summary": {
                        "total": total_vms,
                        "running": running_vms,
                        "stopped": stopped_vms,
                        "provisioning": provisioning_vms,
                    },
                    "nodes": [{"name": "unknown", "status": "offline", "cpu_percent": 0, "ram_percent": 0, "vm_count": total_vms}],
                    "storage_pools": [],
                }
            }, status=200)

class AdminHardwareCpuHistoryView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        import time

        # Was 100% random.uniform() data — replaced with real Proxmox RRD
        # (round-robin database) history, the same mechanism Proxmox's own
        # UI graphs use.
        try:
            from apps.vms.services.proxmox_service import get_proxmox_service
            ps = get_proxmox_service()
            rrd = ps.proxmox.nodes(ps.node).rrddata.get(timeframe='hour')

            data = []
            # Sample every 5th point so the chart isn't overloaded with the
            # full 60-entry hour of data.
            for point in rrd[::5]:
                mem_total = point.get('memtotal') or 1
                data.append({
                    "time": time.strftime('%H:%M', time.localtime(point.get('time', 0))),
                    "cpu": round((point.get('cpu') or 0) * 100, 1),
                    "ram": round((point.get('memused') or 0) / mem_total * 100, 1),
                })
            return Response({"success": True, "data": data})
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f'AdminHardwareCpuHistoryView: Proxmox RRD query failed: {e}', exc_info=True)
            return Response({"success": False, "message": str(e), "data": []})
