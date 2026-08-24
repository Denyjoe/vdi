from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import VMTemplate, VirtualMachine
from .serializers import VMTemplateSerializer, VirtualMachineSerializer
from .services.vm_orchestrator import VMOrchestrator

class VMTemplateListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = VMTemplateSerializer

    def get_queryset(self):
        # Phase 6 — account context switching. No/'personal' context (the
        # default, unchanged for every existing caller) shows only
        # platform-wide templates (university IS NULL); a real, validated
        # university context shows that university's own scoped catalogue
        # instead. resolve_context_university raises 400/403 itself for a
        # bad/unauthorized value - this queryset is never reached with an
        # unvalidated id.
        from apps.university.permissions import resolve_context_university
        _is_scoped, university_id = resolve_context_university(self.request)
        qs = VMTemplate.objects.filter(is_available=True)
        return qs.filter(university_id=university_id) if university_id else qs.filter(university__isnull=True)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

class VMTemplateDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    queryset = VMTemplate.objects.filter(is_available=True)
    serializer_class = VMTemplateSerializer

class VMListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VirtualMachineSerializer
    
    def get_queryset(self):
        return VirtualMachine.objects.filter(owner=self.request.user).exclude(status='deleted')
        
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

class VMRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        template_id = request.data.get('template_id')
        template = get_object_or_404(VMTemplate, id=template_id, is_available=True)
        orchestrator = VMOrchestrator()
        result = orchestrator.request_vm(template, request.user)
        if result['success']:
            return Response({"success": True, "data": VirtualMachineSerializer(result['vm']).data}, status=status.HTTP_201_CREATED)
        return Response({"success": False, "message": result.get('error', 'Error')}, status=status.HTTP_400_BAD_REQUEST)

class VMDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VirtualMachineSerializer
    def get_queryset(self):
        return VirtualMachine.objects.filter(owner=self.request.user)

class VMStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, pk):
        vm = get_object_or_404(VirtualMachine, pk=pk, owner=request.user)
        return Response({"success": True, "data": {"status": vm.status, "cpu": vm.cpu_usage, "ram": vm.ram_usage}})

class VMStopView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        vm = get_object_or_404(VirtualMachine, pk=pk, owner=request.user)
        orchestrator = VMOrchestrator()
        res = orchestrator.stop_vm(vm)
        return Response({"success": res['success']})

class VMStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        vm = get_object_or_404(VirtualMachine, pk=pk, owner=request.user)
        orchestrator = VMOrchestrator()
        res = orchestrator.start_vm(vm)

        # This bypasses Workspace._perform_launch (it operates on a raw VM,
        # not a Workspace), so it must independently refresh the owning
        # workspace's activity timestamp — otherwise starting a VM through
        # this legacy path would silently look idle to the cleanup job.
        from .models import Workspace
        from django.utils import timezone
        Workspace.objects.filter(vm=vm).update(last_accessed_at=timezone.now())

        return Response({"success": res['success']})

class VMDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def delete(self, request, pk):
        vm = get_object_or_404(VirtualMachine, pk=pk, owner=request.user)
        orchestrator = VMOrchestrator()
        res = orchestrator.deprovision_real_vm(vm)
        return Response({"success": res['success']})
