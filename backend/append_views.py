import os

views_code = '''

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
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = PracticalSessionSerializer

    def get_queryset(self):
        return PracticalSession.objects.filter(
            student_access__student=self.request.user
        ).select_related('class_room', 'required_vm_template', 'lecturer')

    def list(self, request, *args, **kwargs):
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
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, *args, **kwargs):
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
'''

with open(r"c:\Users\Denis Wilson\Desktop\dit-vdi-system\backend\apps\sessions\views.py", "a", encoding="utf-8") as f:
    f.write(views_code)

print("Views appended successfully.")
