from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Workspace, VMTemplate, VirtualMachine
from .serializers import WorkspaceSerializer
from apps.users.models import UserSubscription, ComputeUsageLog
from apps.vms.services.vm_orchestrator import VMOrchestrator
from apps.notifications.services import notify

class WorkspaceListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WorkspaceSerializer

    def get_queryset(self):
        return Workspace.objects.filter(owner=self.request.user).exclude(status='deleted')

class WorkspaceCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = WorkspaceSerializer(data=request.data)
        if serializer.is_valid():
            try:
                from apps.users.models import SystemConfig
                max_per_user = int(SystemConfig.get('max_vms_per_user', '3'))
                
                try:
                    sub = request.user.subscription
                    max_w = getattr(sub.plan, 'max_workspaces', -1)
                    plan_name = sub.plan.display_name
                except Exception:
                    max_w = -1
                    plan_name = ''
                
                current_w = Workspace.objects.filter(owner=request.user).exclude(status='deleted').count()
                
                if current_w >= max_per_user:
                    return Response({
                        "success": False,
                        "message": f"You have reached the platform maximum of {max_per_user} workspace(s). Delete an existing workspace to create a new one."
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                if max_w != -1 and current_w >= max_w:
                    return Response({
                        "success": False,
                        "message": f"Workspace limit reached for {plan_name} plan"
                    }, status=status.HTTP_403_FORBIDDEN)
                    
                workspace = serializer.save(owner=request.user)
                # Log: 'WORKSPACE_CREATED'
                return Response({
                    "success": True,
                    "data": WorkspaceSerializer(workspace).data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
                
        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

class WorkspaceDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WorkspaceSerializer
    
    def get_queryset(self):
        return Workspace.objects.filter(owner=self.request.user).exclude(status='deleted')

class WorkspaceLaunchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        workspace = get_object_or_404(Workspace, pk=pk, owner=request.user)
        
        from apps.users.models import SystemConfig
        from apps.vms.models import VirtualMachine
        
        max_concurrent = int(SystemConfig.get('max_concurrent_vms', '10'))
        active_vms = VirtualMachine.objects.filter(status='running').count()
        if active_vms >= max_concurrent:
            return Response({
                "success": False,
                "message": "Platform is at maximum capacity. Please try again shortly."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            sub = request.user.subscription
            if sub.hours_remaining <= 0:
                return Response({
                    "success": False,
                    "message": "No compute hours remaining. Upgrade your plan to continue."
                }, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass
            
        if workspace.status == 'deleted':
            return Response({"success": False, "message": "Workspace is deleted"}, status=status.HTTP_400_BAD_REQUEST)
            
        orchestrator = VMOrchestrator()
        
        try:
            if not workspace.vm:
                # Create a VirtualMachine record
                vm = VirtualMachine.objects.create(
                    name=f"workspace-{workspace.id}-{request.user.username}",
                    owner=request.user,
                    template=workspace.vm_template,
                    status='provisioning'
                )
                workspace.vm = vm
                workspace.status = 'active'
                workspace.last_accessed_at = timezone.now()
                workspace.save()
                
                # Start provisioning asynchronously
                if workspace.vm_template.is_real:
                    import threading
                    thread = threading.Thread(target=orchestrator.provision_real_vm, args=(vm,))
                    thread.daemon = True
                    thread.start()
                else:
                    orchestrator.provision_vm(vm)
                    
            else:
                if workspace.vm.status != 'running' and workspace.vm.status != 'provisioning':
                    workspace.vm.status = 'provisioning'
                    workspace.vm.save()
                    
                    workspace.status = 'active'
                    workspace.last_accessed_at = timezone.now()
                    workspace.save()
                    
                    if workspace.vm_template.is_real:
                        import threading
                        thread = threading.Thread(target=orchestrator.start_real_vm, args=(workspace,))
                        thread.daemon = True
                        thread.start()
                    else:
                        orchestrator.start_vm(workspace.vm)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Proxmox provisioning failed: {str(e)}')
            return Response({
                'success': False,
                'message': (
                    'Unable to start your '
                    'workspace right now. '
                    'Our infrastructure team '
                    'has been notified. '
                    'Please try again in a '
                    'few minutes.'
                )
            }, status=503)
            
            workspace.status = 'active'
            workspace.last_accessed_at = timezone.now()
            workspace.save()
            
        # Log: 'WORKSPACE_LAUNCHED'
        ComputeUsageLog.objects.create(
            user=request.user,
            vm=workspace.vm,
            session_type='workspace'
        )
        
        notify(
            user=request.user,
            title='Workspace Launched',
            message=f'Launched {workspace.name}',
            notification_type='workspace_ready',
            link=f'/workspace/{workspace.id}'
        )
        
        return Response({
            "success": True,
            "data": WorkspaceSerializer(workspace).data
        })

class WorkspaceStopView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        workspace = get_object_or_404(Workspace, pk=pk, owner=request.user)
        
        if workspace.status != 'active' or not workspace.vm:
            return Response({"success": False, "message": "Workspace is not active"}, status=status.HTTP_400_BAD_REQUEST)
            
        orchestrator = VMOrchestrator()
        result = orchestrator.stop_vm(workspace.vm)
        
        from apps.vms.services.pool_service import VMPoolService
        pool = VMPoolService()
        pool.release_vm(workspace.vm)
        
        workspace.status = 'stopped'
        workspace.save()
        
        # Calculate hours
        log = ComputeUsageLog.objects.filter(user=request.user, vm=workspace.vm, ended_at__isnull=True).order_by('-started_at').first()
        if log:
            log.ended_at = timezone.now()
            diff = (log.ended_at - log.started_at).total_seconds() / 3600.0
            log.hours_used = diff
            log.save()
            
            workspace.compute_hours_used += diff
            workspace.save()
            
            try:
                sub = request.user.subscription
                sub.compute_hours_used += diff
                sub.save()
            except Exception:
                pass
                
        # Log: 'WORKSPACE_STOPPED'
        notify(
            user=request.user,
            title='Workspace Stopped',
            message=f'Stopped {workspace.name}',
            notification_type='workspace_stopped',
            link='/workspaces'
        )
        return Response({"success": True})

class WorkspaceDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            from apps.vms.models import Workspace
            ws = Workspace.objects.get(id=pk, owner=request.user)
        except Workspace.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)
        
        errors = []
        
        # 1. Delete Guacamole connection
        if ws.vm and getattr(ws.vm, 'guacamole_connection_id', None):
            try:
                from apps.vms.services.guacamole_service import GuacamoleService
                gs = GuacamoleService()
                gs.authenticate()
                gs.delete_connection(ws.vm.guacamole_connection_id)
                print(f'Guacamole connection {ws.vm.guacamole_connection_id} deleted successfully')
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f'FAILED to delete Guacamole connection: {str(e)}', exc_info=True)
                errors.append(f'Guacamole cleanup: {str(e)}')
        
        # 2. Stop and destroy the actual Proxmox VM
        if ws.vm and getattr(ws.vm, 'proxmox_vm_id', None):
            try:
                from apps.vms.services.proxmox_service import ProxmoxService
                ps = ProxmoxService()
                ps.delete_vm_completely(ws.vm.proxmox_vm_id)
                print(f'Proxmox VM {ws.vm.proxmox_vm_id} genuinely confirmed deleted')
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f'FAILED to delete Proxmox VM: {str(e)}', exc_info=True)
                return Response({
                    'success': False,
                    'message': (
                        f'Failed to delete VM from infrastructure: '
                        f'{str(e)}. Please try again or contact support.'
                    )
                }, status=500)
        
        # 3. Delete DB records
        vm_id = ws.vm.id if ws.vm else None
        ws.delete()
        if vm_id:
            from apps.vms.models import VirtualMachine
            VirtualMachine.objects.filter(id=vm_id).delete()
        
        if errors:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f'Workspace delete had partial infra errors: {errors}')
        
        return Response({
            'success': True,
            'message': 'Workspace permanently deleted',
        })

class WorkspaceStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, pk):
        from apps.vms.models import Workspace
        ws = get_object_or_404(Workspace, id=pk, owner=request.user)
        
        if not ws.vm:
            return Response({'status': 'stopped'})
        
        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            ps = ProxmoxService()
            
            vmid = ws.vm.proxmox_vm_id if hasattr(ws.vm, 'proxmox_vm_id') else getattr(ws.vm, 'proxmox_vmid', None)
            
            if not vmid:
                return Response({'status': 'no_vm'})
            
            status_data = ps.proxmox.nodes(ps.node).qemu(vmid).status.current.get()
            
            return Response({
                'status': status_data.get('status', 'unknown'),
                'cpu_usage': round(status_data.get('cpu', 0) * 100, 1),
                'cpu_cores': status_data.get('cpus', 0),
                'ram_used_mb': round(status_data.get('mem', 0) / (1024**2)),
                'ram_total_mb': round(status_data.get('maxmem', 0) / (1024**2)),
                'disk_used_gb': round(status_data.get('disk', 0) / (1024**3), 1),
                'disk_total_gb': round(status_data.get('maxdisk', 0) / (1024**3), 1),
                'network_in': status_data.get('netin', 0),
                'network_out': status_data.get('netout', 0),
                'uptime_seconds': status_data.get('uptime', 0),
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'error': str(e)
            })
