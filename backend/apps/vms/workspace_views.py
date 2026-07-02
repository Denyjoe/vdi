from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Workspace, VMTemplate, VirtualMachine
from .serializers import WorkspaceSerializer
from apps.users.models import UserSubscription, ComputeUsageLog
from apps.vms.services.vm_orchestrator import VMOrchestrator

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
                sub = request.user.subscription
                max_w = sub.plan.max_workspaces
                current_w = Workspace.objects.filter(owner=request.user).exclude(status='deleted').count()
                
                if max_w != -1 and current_w >= max_w:
                    return Response({
                        "success": False,
                        "message": f"Workspace limit reached for {sub.plan.display_name} plan"
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
        
        if not workspace.vm:
            # Request new VM
            result = orchestrator.request_vm(workspace.vm_template, request.user)
            if not result['success']:
                return Response({"success": False, "message": result.get('error', 'Failed to provision VM')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
            workspace.vm = result['vm']
            workspace.status = 'active'
            workspace.last_accessed_at = timezone.now()
            workspace.save()
        else:
            if workspace.vm.status != 'running':
                result = orchestrator.start_vm(workspace.vm)
                if not result['success']:
                    return Response({"success": False, "message": result.get('error', 'Failed to start VM')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            workspace.status = 'active'
            workspace.last_accessed_at = timezone.now()
            workspace.save()
            
        # Log: 'WORKSPACE_LAUNCHED'
        ComputeUsageLog.objects.create(
            user=request.user,
            vm=workspace.vm,
            session_type='workspace'
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
        
        if not result['success']:
            return Response({"success": False, "message": result.get('error', 'Failed to stop VM')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
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
        return Response({"success": True})

class WorkspaceDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        workspace = get_object_or_404(Workspace, pk=pk, owner=request.user)
        
        if workspace.vm:
            orchestrator = VMOrchestrator()
            if workspace.vm.status == 'running':
                orchestrator.stop_vm(workspace.vm)
            orchestrator.release_vm(workspace.vm)
            
        workspace.status = 'deleted'
        workspace.save()
        return Response({"success": True})
