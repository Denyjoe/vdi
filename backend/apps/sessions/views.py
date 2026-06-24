from rest_framework import views, generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from apps.users.permissions import IsStudent, IsLecturer, IsAdmin
from apps.vms.models import VirtualMachine
from apps.classes.models import Class
from .models import RemoteSession
from .serializers import RemoteSessionSerializer
from .services.remote_session_manager import session_manager

class ConnectSessionView(views.APIView):
    permission_classes = [IsAuthenticated, IsStudent]
    
    def post(self, request):
        vm_id = request.data.get('vm_id')
        if not vm_id:
            return Response({"success": False, "message": "vm_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        vm = get_object_or_404(VirtualMachine, id=vm_id, owner=request.user)
        
        try:
            ip_address = request.META.get('REMOTE_ADDR')
            session = session_manager.connect(vm, request.user, ip_address)
            token = session_manager.generate_session_token(session)
            
            return Response({
                "success": True,
                "data": {
                    "session_id": session.id,
                    "session_token": token,
                    "vm_name": vm.name,
                    "template_name": vm.template.name,
                    "os": vm.template.os,
                    "resolution": "1920x1080",
                    "connected_at": session.started_at,
                    "restrictions": {
                        "internet": True,
                        "copy_paste": True
                    }
                }
            })
        except ValueError as e:
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class DisconnectSessionView(views.APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        session = get_object_or_404(RemoteSession, id=pk)
        if request.user.role == 'student' and session.user != request.user:
            return Response({"success": False, "message": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
            
        if session.status != 'active':
            return Response({"success": False, "message": "Session is not active"}, status=status.HTTP_400_BAD_REQUEST)
            
        session = session_manager.disconnect(session)
        serializer = RemoteSessionSerializer(session)
        return Response({
            "success": True,
            "data": serializer.data
        })

class MySessionsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RemoteSessionSerializer
    
    def get_queryset(self):
        qs = RemoteSession.objects.filter(user=self.request.user).order_by('-started_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs
        
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data
        })

class ActiveSessionView(views.APIView):
    permission_classes = [IsAuthenticated, IsStudent]
    
    def get(self, request):
        session = RemoteSession.objects.filter(user=request.user, status='active').first()
        if session:
            serializer = RemoteSessionSerializer(session)
            return Response({
                "success": True,
                "data": serializer.data
            })
        return Response({
            "success": True,
            "data": None
        })

class LecturerActiveSessionsView(views.APIView):
    permission_classes = [IsAuthenticated, IsLecturer]
    
    def get(self, request):
        classes = Class.objects.filter(lecturer=request.user)
        result = {}
        for c in classes:
            sessions = session_manager.get_active_sessions(class_room=c)
            session_data = []
            for s in sessions:
                duration = int((timezone.now() - s.started_at).total_seconds())
                session_data.append({
                    "id": s.id,
                    "student_name": f"{s.user.first_name} {s.user.last_name}",
                    "vm_name": s.vm.name,
                    "duration_seconds": duration,
                    "ip_address": s.ip_address
                })
            if session_data:
                result[c.name] = session_data
                
        return Response({
            "success": True,
            "data": result
        })

class AdminSessionsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = RemoteSessionSerializer
    
    def get_queryset(self):
        qs = RemoteSession.objects.all().order_by('-started_at')
        status_filter = self.request.query_params.get('status')
        user_id = self.request.query_params.get('user_id')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs
        
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data
        })

class AdminTerminateSessionView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def post(self, request, pk):
        session = get_object_or_404(RemoteSession, id=pk)
        if session.status != 'active':
            return Response({"success": False, "message": "Session is not active"}, status=status.HTTP_400_BAD_REQUEST)
            
        session = session_manager.terminate(session, request.user)
        serializer = RemoteSessionSerializer(session)
        return Response({
            "success": True,
            "data": serializer.data
        })

class LecturerTerminateSessionView(views.APIView):
    permission_classes = [IsAuthenticated, IsLecturer]
    
    def post(self, request, pk):
        session = get_object_or_404(RemoteSession, id=pk)
        if session.status != 'active':
            return Response({"success": False, "message": "Session is not active"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Verify student is in lecturer's class
        classes = Class.objects.filter(lecturer=request.user)
        is_enrolled = session.vm.owner.enrollments.filter(class_room__in=classes).exists()
        if not is_enrolled:
            return Response({"success": False, "message": "Not authorized to terminate this session"}, status=status.HTTP_403_FORBIDDEN)
            
        session = session_manager.terminate(session, request.user)
        serializer = RemoteSessionSerializer(session)
        return Response({
            "success": True,
            "data": serializer.data
        })
