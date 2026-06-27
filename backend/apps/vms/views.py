from rest_framework import views, status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsStudent, IsAdmin
from .models import VMTemplate, VirtualMachine
from .serializers import VMTemplateSerializer, AdminVMTemplateSerializer, VirtualMachineSerializer, VMRequestSerializer
from .services.vm_orchestrator import orchestrator
import threading
import random
import datetime

class VMTemplateListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VMTemplateSerializer

    def get_queryset(self):
        return VMTemplate.objects.filter(is_available=True)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Templates retrieved successfully"
        }, status=status.HTTP_200_OK)

class VMTemplateDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VMTemplateSerializer
    queryset = VMTemplate.objects.all()

class VMListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'admin':
            queryset = VirtualMachine.objects.all().order_by('-allocated_at')
        else:
            queryset = VirtualMachine.objects.filter(owner=request.user).exclude(status='deleted').order_by('-allocated_at')
        
        serializer = VirtualMachineSerializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "VMs retrieved successfully"
        }, status=status.HTTP_200_OK)

class VMRequestView(views.APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):
        serializer = VMRequestSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            template_id = serializer.validated_data['template_id']
            notes = serializer.validated_data.get('notes', '')
            
            try:
                template = VMTemplate.objects.get(id=template_id, is_available=True)
            except VMTemplate.DoesNotExist:
                return Response({
                    "success": False,
                    "error": "Template not found or unavailable",
                    "message": "VM request failed"
                }, status=status.HTTP_404_NOT_FOUND)
            
            vm = VirtualMachine.objects.create(
                template=template,
                owner=request.user,
                name=f"{template.name} — {request.user.first_name}",
                status='provisioning',
                notes=notes
            )
            
            # Start provisioning in a thread
            thread = threading.Thread(target=orchestrator.provision_vm, args=(vm,))
            thread.start()
            
            vm_serializer = VirtualMachineSerializer(vm)
            
            orchestrator._log_activity(vm, 'VM_REQUESTED')

            return Response({
                "success": True,
                "data": vm_serializer.data,
                "message": "VM requested successfully"
            }, status=status.HTTP_201_CREATED)
            
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "VM request failed"
        }, status=status.HTTP_400_BAD_REQUEST)

class VMDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            if request.user.role == 'admin':
                vm = VirtualMachine.objects.get(pk=pk)
            else:
                vm = VirtualMachine.objects.get(pk=pk, owner=request.user)
                
            serializer = VirtualMachineSerializer(vm)
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "VM retrieved successfully"
            }, status=status.HTTP_200_OK)
        except VirtualMachine.DoesNotExist:
            return Response({
                "success": False,
                "error": "VM not found",
                "message": "Retrieval failed"
            }, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        try:
            if request.user.role == 'admin':
                vm = VirtualMachine.objects.get(pk=pk)
            else:
                vm = VirtualMachine.objects.get(pk=pk, owner=request.user)
                if vm.status == 'running':
                    return Response({
                        "success": False,
                        "error": "Cannot delete a running VM. Stop it first.",
                        "message": "Delete failed"
                    }, status=status.HTTP_400_BAD_REQUEST)
                
            orchestrator.delete_vm(vm)
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except VirtualMachine.DoesNotExist:
            return Response({
                "success": False,
                "error": "VM not found",
                "message": "Delete failed"
            }, status=status.HTTP_404_NOT_FOUND)

class VMStatusView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            if request.user.role == 'admin':
                vm = VirtualMachine.objects.get(pk=pk)
            else:
                vm = VirtualMachine.objects.get(pk=pk, owner=request.user)
                
            status_data = orchestrator.get_vm_status(vm)
            return Response({
                "success": True,
                "data": status_data,
                "message": "Status retrieved successfully"
            }, status=status.HTTP_200_OK)
        except VirtualMachine.DoesNotExist:
            return Response({
                "success": False,
                "error": "VM not found",
                "message": "Retrieval failed"
            }, status=status.HTTP_404_NOT_FOUND)

class VMStopView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            if request.user.role == 'admin':
                vm = VirtualMachine.objects.get(pk=pk)
            else:
                vm = VirtualMachine.objects.get(pk=pk, owner=request.user)
                
            if vm.status == 'stopped':
                return Response({
                    "success": False,
                    "error": "VM is already stopped",
                    "message": "Stop failed"
                }, status=status.HTTP_400_BAD_REQUEST)
                
            orchestrator.stop_vm(vm)
            orchestrator._log_activity(vm, 'VM_STOP_REQUESTED')
            
            serializer = VirtualMachineSerializer(vm)
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "VM stopped successfully"
            }, status=status.HTTP_200_OK)
        except VirtualMachine.DoesNotExist:
            return Response({
                "success": False,
                "error": "VM not found",
                "message": "Stop failed"
            }, status=status.HTTP_404_NOT_FOUND)

class VMStartView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            if request.user.role == 'admin':
                vm = VirtualMachine.objects.get(pk=pk)
            else:
                vm = VirtualMachine.objects.get(pk=pk, owner=request.user)
                
            if vm.status != 'stopped':
                return Response({
                    "success": False,
                    "error": "Only stopped VMs can be started",
                    "message": "Start failed"
                }, status=status.HTTP_400_BAD_REQUEST)
                
            orchestrator.start_vm(vm)
            
            serializer = VirtualMachineSerializer(vm)
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "VM started successfully"
            }, status=status.HTTP_200_OK)
        except VirtualMachine.DoesNotExist:
            return Response({
                "success": False,
                "error": "VM not found",
                "message": "Start failed"
            }, status=status.HTTP_404_NOT_FOUND)

class AdminVMListView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        queryset = VirtualMachine.objects.all().order_by('-allocated_at')
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        serializer = VirtualMachineSerializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "All VMs retrieved successfully"
        }, status=status.HTTP_200_OK)

class AdminVMForceStopView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            vm = VirtualMachine.objects.get(pk=pk)
            orchestrator.stop_vm(vm)
            
            orchestrator._log_activity(vm, 'VM_FORCE_STOPPED', {'stopped_by': request.user.email})
            
            serializer = VirtualMachineSerializer(vm)
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "VM force stopped successfully"
            }, status=status.HTTP_200_OK)
        except VirtualMachine.DoesNotExist:
            return Response({
                "success": False,
                "error": "VM not found",
                "message": "Force stop failed"
            }, status=status.HTTP_404_NOT_FOUND)

class HardwareStatsView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        ram_total_gb = 64
        ram_used_gb = round(random.uniform(20.0, 45.0), 1)
        ram_percent = round((ram_used_gb / ram_total_gb) * 100, 1)

        vms = VirtualMachine.objects.exclude(status='deleted')
        
        data = {
            "cpu_percent": round(random.uniform(35.0, 75.0), 1),
            "ram_total_gb": ram_total_gb,
            "ram_used_gb": ram_used_gb,
            "ram_percent": ram_percent,
            "storage_pools": [
                {
                    "name": "local-lvm",
                    "total_gb": 2000,
                    "used_gb": random.randint(400, 900),
                    "type": "LVM"
                },
                {
                    "name": "backup-store",
                    "total_gb": 4000,
                    "used_gb": random.randint(800, 2000),
                    "type": "NFS"
                }
            ],
            "network": {
                "bytes_in_per_sec": random.randint(50000, 500000),
                "bytes_out_per_sec": random.randint(30000, 300000),
                "interface": "eth0"
            },
            "nodes": [
                {
                    "name": "proxmox-node-1",
                    "status": "online",
                    "cpu_percent": round(random.uniform(30.0, 70.0), 1),
                    "ram_percent": round(random.uniform(40.0, 75.0), 1),
                    "vm_count": vms.count()
                }
            ],
            "vm_summary": {
                "total": vms.count(),
                "running": vms.filter(status='running').count(),
                "stopped": vms.filter(status='stopped').count(),
                "provisioning": vms.filter(status='provisioning').count()
            },
            "uptime_days": random.randint(45, 180),
            "proxmox_version": "8.1.4"
        }

        return Response({
            "success": True,
            "data": data,
            "message": "Hardware stats retrieved successfully"
        }, status=status.HTTP_200_OK)

class HardwareCpuHistoryView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        now = datetime.datetime.now()
        
        # Start at a random baseline
        current_cpu = random.uniform(40.0, 60.0)
        current_ram = random.uniform(50.0, 70.0)
        
        history = []
        for i in range(20, 0, -1):
            time_point = now - datetime.timedelta(minutes=i)
            
            # Gradual drift
            current_cpu += random.uniform(-5.0, 5.0)
            current_ram += random.uniform(-2.0, 2.0)
            
            # Bound the values
            current_cpu = max(5.0, min(95.0, current_cpu))
            current_ram = max(20.0, min(90.0, current_ram))
            
            history.append({
                "time": time_point.strftime("%H:%M"),
                "cpu": round(current_cpu, 1),
                "ram": round(current_ram, 1)
            })

        return Response({
            "success": True,
            "data": history,
            "message": "CPU history retrieved successfully"
        }, status=status.HTTP_200_OK)


class AdminTemplateListCreateView(views.APIView):
    """
    GET  /api/admin/vms/templates/  — List ALL templates (including unavailable).
    POST /api/admin/vms/templates/  — Create a new template.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        queryset = VMTemplate.objects.all().order_by('name')
        serializer = AdminVMTemplateSerializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Templates retrieved successfully"
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = AdminVMTemplateSerializer(data=request.data)
        if serializer.is_valid():
            template = serializer.save()
            return Response({
                "success": True,
                "data": AdminVMTemplateSerializer(template).data,
                "message": "Template created successfully"
            }, status=status.HTTP_201_CREATED)
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "Template creation failed"
        }, status=status.HTTP_400_BAD_REQUEST)


class AdminTemplateDetailView(views.APIView):
    """
    GET    /api/admin/vms/templates/<id>/  — Retrieve single template.
    PATCH  /api/admin/vms/templates/<id>/  — Update any template field.
    DELETE /api/admin/vms/templates/<id>/  — Soft-delete (sets is_available=False).
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def _get_template(self, pk):
        """Helper that returns a template or raises a 404 response."""
        try:
            return VMTemplate.objects.get(pk=pk), None
        except VMTemplate.DoesNotExist:
            return None, Response({
                "success": False,
                "error": "Template not found",
                "message": "Operation failed"
            }, status=status.HTTP_404_NOT_FOUND)

    def get(self, request, pk):
        template, err = self._get_template(pk)
        if err:
            return err
        serializer = AdminVMTemplateSerializer(template)
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Template retrieved successfully"
        }, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        template, err = self._get_template(pk)
        if err:
            return err
        serializer = AdminVMTemplateSerializer(template, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "Template updated successfully"
            }, status=status.HTTP_200_OK)
        return Response({
            "success": False,
            "error": serializer.errors,
            "message": "Template update failed"
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        """Soft-delete: set is_available=False. Never hard-delete (VMs reference this)."""
        template, err = self._get_template(pk)
        if err:
            return err
        template.is_available = False
        template.save(update_fields=['is_available'])
        return Response({
            "success": True,
            "data": {"id": template.id, "is_available": False},
            "message": f"Template '{template.name}' has been deactivated."
        }, status=status.HTTP_200_OK)
