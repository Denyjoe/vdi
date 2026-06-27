from rest_framework import views, generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from apps.users.permissions import IsStudent, IsLecturer, IsAdmin
from apps.vms.models import VirtualMachine
from apps.classes.models import Class
from .models import RemoteSession, ExamSession, ActivityLog
from .serializers import (
    RemoteSessionSerializer, 
    ExamSessionSerializer, 
    ExamSessionCreateSerializer, 
    LiveStudentSessionSerializer
)
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

class LecturerExamSessionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]
    
    def get_queryset(self):
        return ExamSession.objects.filter(lecturer=self.request.user).order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ExamSessionCreateSerializer
        return ExamSessionSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            exam = serializer.save(lecturer=request.user, status='scheduled')
            ActivityLog.objects.create(
                user=request.user,
                action='EXAM_SESSION_CREATED',
                description=f"Created exam session: {exam.name}",
                metadata={"exam_id": exam.id},
                ip_address=request.META.get('REMOTE_ADDR')
            )
            response_serializer = ExamSessionSerializer(exam)
            return Response({"success": True, "data": response_serializer.data}, status=status.HTTP_201_CREATED)
        return Response({"success": False, "message": "Validation failed", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

class LecturerExamSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]
    
    def get_queryset(self):
        return ExamSession.objects.filter(lecturer=self.request.user)

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return ExamSessionCreateSerializer
        return ExamSessionSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ExamSessionSerializer(instance)
        return Response({"success": True, "data": serializer.data})

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = request.data.copy()
        if 'class_room' in data:
            del data['class_room'] # Cannot change class_room after creation
        
        serializer = self.get_serializer(instance, data=data, partial=True, context={'request': request})
        if serializer.is_valid():
            exam = serializer.save()
            response_serializer = ExamSessionSerializer(exam)
            return Response({"success": True, "data": response_serializer.data})
        return Response({"success": False, "message": "Validation failed", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'scheduled':
            return Response({"success": False, "message": "Can only delete scheduled exams"}, status=status.HTTP_400_BAD_REQUEST)
        
        instance.delete()
        return Response({"success": True, "message": "Exam session deleted"}, status=status.HTTP_200_OK)

class LecturerStartExamView(views.APIView):
    permission_classes = [IsAuthenticated, IsLecturer]

    def post(self, request, pk):
        exam = get_object_or_404(ExamSession, pk=pk, lecturer=request.user)
        if exam.status != 'scheduled':
            return Response({"success": False, "message": "Exam must be scheduled to start"}, status=status.HTTP_400_BAD_REQUEST)
        
        exam.status = 'active'
        if not exam.starts_at or exam.starts_at > timezone.now():
            exam.starts_at = timezone.now()
        exam.save()

        ActivityLog.objects.create(
            user=request.user,
            action='EXAM_STARTED',
            description=f"Started exam session: {exam.name}",
            metadata={"exam_id": exam.id},
            ip_address=request.META.get('REMOTE_ADDR')
        )

        serializer = ExamSessionSerializer(exam)
        return Response({"success": True, "data": serializer.data})

class LecturerEndExamView(views.APIView):
    permission_classes = [IsAuthenticated, IsLecturer]

    def post(self, request, pk):
        exam = get_object_or_404(ExamSession, pk=pk, lecturer=request.user)
        exam.status = 'ended'
        exam.ends_at = timezone.now()
        exam.save()

        # Find all active RemoteSessions for students in this exam's class
        active_sessions = RemoteSession.objects.filter(
            user__enrollments__class_room=exam.class_room,
            status='active'
        )
        count = active_sessions.count()

        for session in active_sessions:
            session_manager.terminate(session, request.user)

        ActivityLog.objects.create(
            user=request.user,
            action='EXAM_ENDED',
            description=f"Ended exam session: {exam.name}",
            metadata={"exam_id": exam.id, "terminated_sessions": count},
            ip_address=request.META.get('REMOTE_ADDR')
        )

        serializer = ExamSessionSerializer(exam)
        return Response({
            "success": True, 
            "data": {
                "exam": serializer.data,
                "terminated_sessions": count
            }
        })

class LecturerMonitorView(views.APIView):
    permission_classes = [IsAuthenticated, IsLecturer]

    def get(self, request):
        classes = Class.objects.filter(lecturer=request.user)
        active_exams = ExamSession.objects.filter(lecturer=request.user, status='active')
        
        # Get active sessions for students in all classes
        active_sessions = []
        in_exam_count = 0
        
        for c in classes:
            sessions = session_manager.get_active_sessions(class_room=c)
            for s in sessions:
                # Add duration calculation here so serializer has it
                s.duration_seconds = int((timezone.now() - s.started_at).total_seconds())
                active_sessions.append(s)

        serializer = LiveStudentSessionSerializer(
            active_sessions, 
            many=True,
            context={'active_exams': list(active_exams)}
        )
        
        active_sessions_data = serializer.data
        for s in active_sessions_data:
            if s['is_in_exam']:
                in_exam_count += 1
                
        exam_serializer = ExamSessionSerializer(active_exams, many=True)

        return Response({
            "success": True,
            "data": {
                "active_sessions": active_sessions_data,
                "exam_sessions": exam_serializer.data,
                "summary": {
                    "total_active": len(active_sessions_data),
                    "in_exam": in_exam_count,
                    "free_sessions": len(active_sessions_data) - in_exam_count
                }
            }
        })

class StudentActiveExamSessionView(views.APIView):
    """
    GET /api/sessions/exam/active/

    Returns the currently active exam session for the student,
    scoped strictly to classes they are enrolled in via ClassEnrollment.

    Permission: IsStudent
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        """Return active exam for the student's enrolled classes only."""
        from apps.classes.models import ClassEnrollment

        enrolled_class_ids = ClassEnrollment.objects.filter(
            student=request.user
        ).values_list('class_room_id', flat=True)

        exam = ExamSession.objects.filter(
            class_room_id__in=enrolled_class_ids,
            status='active'
        ).first()

        if not exam:
            return Response({"success": True, "data": None})

        serializer = ExamSessionSerializer(exam)
        return Response({
            "success": True,
            "data": serializer.data
        })


# ══════════════════════════════════════════════════════════════════════════════
# PRACTICAL SESSION MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

from apps.classes.models import ClassEnrollment
from .models import PracticalSession, StudentPracticalAccess
from .serializers import PracticalSessionSerializer, StudentPracticalAccessSerializer

class LecturerPracticalSessionListView(generics.ListCreateAPIView):
    """
    GET  /api/classes/practical-sessions/  → list lecturer's practical sessions
    POST /api/classes/practical-sessions/  → create a new practical session
    """
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = PracticalSessionSerializer

    def get_queryset(self):
        return PracticalSession.objects.filter(
            lecturer=self.request.user
        ).select_related('class_room', 'required_vm_template')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.save(lecturer=request.user)

        # Auto-create access entries for enrolled students
        enrollments = ClassEnrollment.objects.filter(class_room=session.class_room)
        access_records = [
            StudentPracticalAccess(
                practical_session=session,
                student=enrollment.student
            )
            for enrollment in enrollments
        ]
        StudentPracticalAccess.objects.bulk_create(access_records, ignore_conflicts=True)

        ActivityLog.objects.create(
            user=request.user,
            action="PRACTICAL_SESSION_CREATED",
            description=f"Created practical session: {session.name} for {session.class_room.name}",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response(
            {"success": True, "data": serializer.data, "message": "Practical session created."},
            status=201
        )


class LecturerPracticalSessionDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = PracticalSessionSerializer

    def get_queryset(self):
        return PracticalSession.objects.filter(lecturer=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data

        access_qs = instance.student_access.select_related('student').all()
        access_serializer = StudentPracticalAccessSerializer(access_qs, many=True)
        data['student_access'] = access_serializer.data

        return Response({"success": True, "data": data})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        ActivityLog.objects.create(
            user=request.user,
            action="PRACTICAL_SESSION_UPDATED",
            description=f"Updated practical session: {instance.name}",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response(
            {"success": True, "data": serializer.data, "message": "Practical session updated."}
        )


class LecturerStartPracticalView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]

    def post(self, request, *args, **kwargs):
        try:
            session = PracticalSession.objects.get(
                id=self.kwargs['pk'],
                lecturer=request.user
            )
        except PracticalSession.DoesNotExist:
            return Response(
                {"success": False, "message": "Practical session not found."},
                status=404
            )

        if session.status != PracticalSession.Status.SCHEDULED:
            return Response(
                {"success": False, "message": "Session is not in scheduled state."},
                status=400
            )

        session.status = PracticalSession.Status.ACTIVE
        session.save()

        ActivityLog.objects.create(
            user=request.user,
            action="PRACTICAL_SESSION_STARTED",
            description=f"Started practical session: {session.name}",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        serializer = PracticalSessionSerializer(session)
        return Response(
            {"success": True, "data": serializer.data, "message": "Practical session started."}
        )


class LecturerEndPracticalView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]

    def post(self, request, *args, **kwargs):
        try:
            session = PracticalSession.objects.get(
                id=self.kwargs['pk'],
                lecturer=request.user
            )
        except PracticalSession.DoesNotExist:
            return Response(
                {"success": False, "message": "Practical session not found."},
                status=404
            )

        if session.status != PracticalSession.Status.ACTIVE:
            return Response(
                {"success": False, "message": "Session is not active."},
                status=400
            )

        session.status = PracticalSession.Status.COMPLETED
        session.save()

        ActivityLog.objects.create(
            user=request.user,
            action="PRACTICAL_SESSION_ENDED",
            description=f"Ended practical session: {session.name}",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        serializer = PracticalSessionSerializer(session)
        return Response(
            {"success": True, "data": serializer.data, "message": "Practical session ended."}
        )


class StudentPracticalSessionsView(generics.ListAPIView):
    """
    GET /api/sessions/practical/student/

    List practical sessions scoped to classes the student is enrolled in.
    Enforces strict content isolation via ClassEnrollment.

    Permission: IsStudent
    """
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = PracticalSessionSerializer

    def get_queryset(self):
        """Return practical sessions only for the student's enrolled classes."""
        from apps.classes.models import ClassEnrollment
        enrolled_class_ids = ClassEnrollment.objects.filter(
            student=self.request.user
        ).values_list('class_room_id', flat=True)

        return PracticalSession.objects.filter(
            class_room_id__in=enrolled_class_ids
        ).select_related('class_room', 'required_vm_template', 'lecturer')

    def list(self, request, *args, **kwargs):
        """Return practical sessions with per-student access metadata."""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data

        access_map = {
            access.practical_session_id: access
            for access in StudentPracticalAccess.objects.filter(student=request.user)
        }
        for item in data:
            access = access_map.get(item['id'])
            if access:
                item['my_access'] = {
                    'has_attended': access.has_attended,
                    'joined_at': access.joined_at,
                    'submitted_at': access.submitted_at,
                    'grade': access.grade,
                }

        return Response({"success": True, "data": data})


class StudentPracticalSubmitView(generics.GenericAPIView):
    """
    POST /api/sessions/practical/<pk>/submit/

    Submit a file for a practical session.
    Validates the student has access via StudentPracticalAccess.

    Permission: IsStudent
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, *args, **kwargs):
        """Handle practical session file submission."""
        session_id = self.kwargs['pk']

        try:
            access = StudentPracticalAccess.objects.get(
                practical_session_id=session_id,
                student=request.user
            )
        except StudentPracticalAccess.DoesNotExist:
            return Response(
                {"success": False, "message": "You do not have access to this session."},
                status=403
            )

        session = access.practical_session
        if session.status == PracticalSession.Status.CANCELLED:
            return Response(
                {"success": False, "message": "This session has been cancelled."},
                status=400
            )

        submitted_file = request.FILES.get('file')
        if not submitted_file:
            return Response(
                {"success": False, "message": "No file provided."},
                status=400
            )

        access.submission_file = submitted_file
        access.submitted_at = timezone.now()
        access.save()

        ActivityLog.objects.create(
            user=request.user,
            action="PRACTICAL_SUBMISSION",
            description=f"Submitted work for: {session.name}",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        serializer = StudentPracticalAccessSerializer(access)
        return Response(
            {"success": True, "data": serializer.data, "message": "Submission uploaded."}
        )
