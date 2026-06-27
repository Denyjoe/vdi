"""
Views for the classes application.

Covers:
- Class CRUD (lecturer + admin)
- Enrollment management (student requests, lecturer approvals)
- Department, Programme, CourseStream listings (dropdown data)
- Admin stream/programme management
- Practical session management (lecturer CRUD, student access)
"""

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from apps.users.permissions import IsLecturer, IsAdmin, IsStudent
from apps.users.models import User
from .models import (
    Class, ClassEnrollment, EnrollmentRequest,
    CourseStream, Department, Programme,
)
from .serializers import (
    ClassSerializer, ClassEnrollmentSerializer,
    EnrollmentRequestSerializer, ProgrammeSerializer,
    CourseStreamSerializer as DRFCourseStreamSerializer,
)
from apps.sessions.models import ActivityLog
from django.db.models import Exists, OuterRef, Prefetch, Count


def log_activity(user, action, description, ip_address=None):
    """
    Create an activity log entry for audit trail.

    Args:
        user: The user who performed the action.
        action: Short action code (e.g. 'CLASS_CREATED').
        description: Human-readable description of the event.
        ip_address: Optional client IP address.
    """
    ActivityLog.objects.create(
        user=user,
        action=action,
        description=description,
        ip_address=ip_address
    )


# ══════════════════════════════════════════════════════════════════════════════
# LECTURER CLASS MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

class MyClassesView(generics.ListAPIView):
    """
    GET /api/classes/my-classes/

    Returns all classes owned by the authenticated lecturer.
    Permission: IsAuthenticated + IsLecturer
    """
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = ClassSerializer

    def get_queryset(self):
        """Return classes taught by the current user, newest first."""
        return Class.objects.filter(lecturer=self.request.user).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        """Wrap the standard list response in our API envelope."""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


class ClassDetailView(generics.RetrieveAPIView):
    """
    GET /api/classes/<id>/

    Returns a single class with its enrolled students.
    Admins see all, lecturers see their own, students see enrolled classes.
    Permission: IsAuthenticated
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ClassSerializer

    def get_queryset(self):
        """Return class queryset filtered by role."""
        if self.request.user.role == 'admin':
            return Class.objects.all()
        elif self.request.user.role == 'lecturer':
            return Class.objects.filter(lecturer=self.request.user)
        else:
            return Class.objects.filter(enrollments__student=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        """Return class details with enrolled students list."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data

        enrollments = instance.enrollments.all()
        enrollment_serializer = ClassEnrollmentSerializer(enrollments, many=True)
        data['enrolled_students'] = enrollment_serializer.data

        return Response({"success": True, "data": data})


class ClassEnrollmentListView(generics.ListAPIView):
    """
    GET /api/classes/<id>/students/

    Returns all enrolled students for a class.
    Permission: IsAuthenticated (admin or class lecturer only)
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ClassEnrollmentSerializer

    def get_queryset(self):
        """Return enrollments for the specified class."""
        class_id = self.kwargs['pk']
        return ClassEnrollment.objects.filter(class_room_id=class_id).order_by('-enrolled_at')

    def list(self, request, *args, **kwargs):
        """Check authorization and return enrollment list."""
        class_room = Class.objects.filter(id=self.kwargs['pk']).first()
        if not class_room:
            return Response({"success": False, "message": "Class not found"}, status=404)

        if request.user.role != 'admin' and class_room.lecturer != request.user:
            return Response({"success": False, "message": "Not authorized"}, status=403)

        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


class AdminClassListView(generics.ListAPIView):
    """
    GET /api/admin/classes/

    Returns all classes for admin management.
    Permission: IsAuthenticated + IsAdmin
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = ClassSerializer

    def get_queryset(self):
        """Return all classes, newest first."""
        return Class.objects.all().order_by('-created_at')

    def list(self, request, *args, **kwargs):
        """Wrap the list response in our API envelope."""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


class StudentEnrolledClassesView(generics.ListAPIView):
    """
    GET /api/classes/enrolled/

    Returns all classes the authenticated student is enrolled in.
    Permission: IsAuthenticated + IsStudent
    """
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = ClassSerializer

    def get_queryset(self):
        """Return active classes the current student is enrolled in."""
        return Class.objects.filter(
            enrollments__student=self.request.user,
            is_active=True
        ).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        """Wrap the list response in our API envelope."""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


class LecturerCreateClassView(generics.CreateAPIView):
    """
    POST /api/classes/create/

    Create a new class. The authenticated lecturer is set as the owner.
    Permission: IsAuthenticated + IsLecturer
    """
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = ClassSerializer

    def create(self, request, *args, **kwargs):
        """Create a class and log the activity."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        class_room = serializer.save(lecturer=request.user)

        log_activity(
            user=request.user,
            action="CLASS_CREATED",
            description=f"Lecturer created class: {class_room.name}"
        )

        return Response(
            {"success": True, "data": serializer.data, "message": "Class created successfully."},
            status=201
        )


class LecturerUpdateClassView(generics.UpdateAPIView):
    """
    PUT/PATCH /api/classes/<id>/update/

    Update a class owned by the authenticated lecturer.
    Permission: IsAuthenticated + IsLecturer
    """
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = ClassSerializer

    def get_queryset(self):
        """Return only classes owned by the current lecturer."""
        return Class.objects.filter(lecturer=self.request.user)

    def update(self, request, *args, **kwargs):
        """Update the class and log the activity."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        log_activity(
            user=request.user,
            action="CLASS_UPDATED",
            description=f"Lecturer updated class: {instance.name}"
        )

        return Response({"success": True, "data": serializer.data, "message": "Class updated."})


# ══════════════════════════════════════════════════════════════════════════════
# ENROLLMENT REQUEST MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

class LecturerEnrollmentRequestsView(generics.ListAPIView):
    """
    GET /api/classes/<id>/requests/

    Returns enrollment requests for a class owned by the lecturer.
    Supports ?status= filter parameter.
    Permission: IsAuthenticated + IsLecturer
    """
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = EnrollmentRequestSerializer

    def get_queryset(self):
        """Return requests for the specified class, optionally filtered by status."""
        class_id = self.kwargs['pk']
        qs = EnrollmentRequest.objects.filter(
            class_room_id=class_id,
            class_room__lecturer=self.request.user
        )
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by('-requested_at')

    def list(self, request, *args, **kwargs):
        """Wrap the list response in our API envelope."""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


class LecturerApproveEnrollmentView(generics.GenericAPIView):
    """
    POST /api/classes/requests/<id>/approve/

    Approve a pending enrollment request and create the enrollment.
    Permission: IsAuthenticated + IsLecturer
    """
    permission_classes = [IsAuthenticated, IsLecturer]

    def post(self, request, *args, **kwargs):
        """Approve the enrollment request and create enrollment."""
        req_id = self.kwargs['pk']
        try:
            enroll_req = EnrollmentRequest.objects.get(id=req_id, class_room__lecturer=request.user)
        except EnrollmentRequest.DoesNotExist:
            return Response({"success": False, "message": "Request not found."}, status=404)

        if enroll_req.status != 'pending':
            return Response({"success": False, "message": "Request is not pending."}, status=400)

        enroll_req.status = 'approved'
        enroll_req.reviewed_by = request.user
        enroll_req.reviewed_at = timezone.now()
        enroll_req.save()

        # Create enrollment
        ClassEnrollment.objects.get_or_create(
            student=enroll_req.student,
            class_room=enroll_req.class_room
        )

        log_activity(
            user=request.user,
            action="ENROLLMENT_APPROVED",
            description=f"Approved enrollment for {enroll_req.student.email} in {enroll_req.class_room.name}"
        )

        serializer = EnrollmentRequestSerializer(enroll_req)
        return Response({"success": True, "data": serializer.data, "message": "Student approved."})


class LecturerRejectEnrollmentView(generics.GenericAPIView):
    """
    POST /api/classes/requests/<id>/reject/

    Reject a pending enrollment request with an optional reason.
    Permission: IsAuthenticated + IsLecturer
    """
    permission_classes = [IsAuthenticated, IsLecturer]

    def post(self, request, *args, **kwargs):
        """Reject the enrollment request."""
        req_id = self.kwargs['pk']
        try:
            enroll_req = EnrollmentRequest.objects.get(id=req_id, class_room__lecturer=request.user)
        except EnrollmentRequest.DoesNotExist:
            return Response({"success": False, "message": "Request not found."}, status=404)

        if enroll_req.status != 'pending':
            return Response({"success": False, "message": "Request is not pending."}, status=400)

        enroll_req.status = 'rejected'
        enroll_req.rejection_reason = request.data.get('reason', '')
        enroll_req.reviewed_by = request.user
        enroll_req.reviewed_at = timezone.now()
        enroll_req.save()

        log_activity(
            user=request.user,
            action="ENROLLMENT_REJECTED",
            description=f"Rejected enrollment for {enroll_req.student.email} in {enroll_req.class_room.name}"
        )

        serializer = EnrollmentRequestSerializer(enroll_req)
        return Response({"success": True, "data": serializer.data, "message": "Student rejected."})


class LecturerRemoveStudentView(generics.GenericAPIView):
    """
    DELETE /api/classes/<id>/students/<student_id>/

    Remove a student from a class.
    Permission: IsAuthenticated + IsLecturer
    """
    permission_classes = [IsAuthenticated, IsLecturer]

    def delete(self, request, *args, **kwargs):
        """Remove the specified student enrollment."""
        class_id = self.kwargs['pk']
        student_id = self.kwargs['student_id']
        try:
            enrollment = ClassEnrollment.objects.get(
                class_room_id=class_id,
                class_room__lecturer=request.user,
                student_id=student_id
            )
        except ClassEnrollment.DoesNotExist:
            return Response({"success": False, "message": "Enrollment not found."}, status=404)

        student_name = enrollment.student.email
        class_name = enrollment.class_room.name
        enrollment.delete()

        log_activity(
            user=request.user,
            action="STUDENT_REMOVED",
            description=f"Removed {student_name} from {class_name}"
        )

        return Response({"success": True, "message": "Student removed successfully."})


# ══════════════════════════════════════════════════════════════════════════════
# STUDENT ENROLLMENT VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class StudentAvailableClassesView(generics.ListAPIView):
    """
    GET /api/classes/available/

    Returns all active classes the student is NOT enrolled in,
    with request status annotations.
    Permission: IsAuthenticated + IsStudent
    """
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = ClassSerializer

    def get_queryset(self):
        """Return active classes excluding enrolled ones."""
        user = self.request.user
        return Class.objects.filter(is_active=True).exclude(
            enrollments__student=user
        ).order_by('department', 'name')

    def list(self, request, *args, **kwargs):
        """Add enrollment request status annotations to each class."""
        queryset = self.get_queryset()
        requests_dict = {
            req.class_room_id: req
            for req in EnrollmentRequest.objects.filter(student=request.user)
        }

        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        for item in data:
            req = requests_dict.get(item['id'])
            if req:
                item['is_requested'] = True
                item['request_status'] = req.status
                item['rejection_reason'] = req.rejection_reason
                item['request_id'] = req.id
            else:
                item['is_requested'] = False
                item['request_status'] = None

        return Response({"success": True, "data": data})


class StudentRequestEnrollmentView(generics.GenericAPIView):
    """
    POST /api/classes/<id>/request/

    Submit an enrollment request for a class.
    Permission: IsAuthenticated + IsStudent
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, *args, **kwargs):
        """Create an enrollment request for the specified class."""
        class_id = self.kwargs['pk']
        try:
            class_room = Class.objects.get(id=class_id, is_active=True)
        except Class.DoesNotExist:
            return Response({"success": False, "message": "Class not found or inactive."}, status=404)

        if ClassEnrollment.objects.filter(student=request.user, class_room=class_room).exists():
            return Response({"success": False, "message": "Already enrolled."}, status=400)

        if EnrollmentRequest.objects.filter(
            student=request.user, class_room=class_room, status='pending'
        ).exists():
            return Response({"success": False, "message": "Request already pending."}, status=400)

        message = request.data.get('message', '')

        enroll_req = EnrollmentRequest.objects.create(
            student=request.user,
            class_room=class_room,
            message=message
        )

        log_activity(
            user=request.user,
            action="ENROLLMENT_REQUESTED",
            description=f"Requested to join {class_room.name}"
        )

        serializer = EnrollmentRequestSerializer(enroll_req)
        return Response(
            {"success": True, "data": serializer.data, "message": "Enrollment request sent."}
        )


class StudentCancelRequestView(generics.GenericAPIView):
    """
    DELETE /api/classes/requests/<id>/cancel/

    Cancel a pending enrollment request.
    Permission: IsAuthenticated + IsStudent
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def delete(self, request, *args, **kwargs):
        """Delete the enrollment request."""
        req_id = self.kwargs['pk']
        try:
            enroll_req = EnrollmentRequest.objects.get(id=req_id, student=request.user)
        except EnrollmentRequest.DoesNotExist:
            return Response({"success": False, "message": "Request not found."}, status=404)

        class_name = enroll_req.class_room.name
        enroll_req.delete()

        log_activity(
            user=request.user,
            action="ENROLLMENT_CANCELLED",
            description=f"Cancelled enrollment request for {class_name}"
        )

        return Response({"success": True, "message": "Request cancelled."})


class StudentMyRequestsView(generics.ListAPIView):
    """
    GET /api/classes/my-requests/

    Returns all enrollment requests by the authenticated student.
    Permission: IsAuthenticated + IsStudent
    """
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = EnrollmentRequestSerializer

    def get_queryset(self):
        """Return requests by the current student."""
        return EnrollmentRequest.objects.filter(student=self.request.user).order_by('-requested_at')

    def list(self, request, *args, **kwargs):
        """Wrap the list response in our API envelope."""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN CLASS MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

class AdminCreateClassView(generics.CreateAPIView):
    """
    POST /api/admin/classes/create/

    Admin creates a class on behalf of a lecturer.
    Requires lecturer_id in request body.
    Permission: IsAuthenticated + IsAdmin
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = ClassSerializer

    def create(self, request, *args, **kwargs):
        """Create a class with the specified lecturer as owner."""
        lecturer_id = request.data.get('lecturer_id')
        if not lecturer_id:
            return Response({"success": False, "message": "lecturer_id is required."}, status=400)

        try:
            lecturer = User.objects.get(id=lecturer_id, role='lecturer')
        except User.DoesNotExist:
            return Response({"success": False, "message": "Lecturer not found."}, status=404)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        class_room = serializer.save(lecturer=lecturer)

        log_activity(
            user=request.user,
            action="ADMIN_CREATED_CLASS",
            description=f"Admin created class {class_room.name} for {lecturer.email}"
        )

        return Response(
            {"success": True, "data": serializer.data, "message": "Class created successfully."},
            status=201
        )


class AdminEnrollStudentView(generics.GenericAPIView):
    """
    POST /api/admin/classes/<id>/enroll/

    Admin directly enrolls a student into a class.
    Requires student_id in request body.
    Permission: IsAuthenticated + IsAdmin
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, *args, **kwargs):
        """Directly create an enrollment without a request."""
        class_id = self.kwargs['pk']
        student_id = request.data.get('student_id')

        if not student_id:
            return Response({"success": False, "message": "student_id is required."}, status=400)

        try:
            class_room = Class.objects.get(id=class_id)
            student = User.objects.get(id=student_id, role='student')
        except (Class.DoesNotExist, User.DoesNotExist):
            return Response({"success": False, "message": "Class or student not found."}, status=404)

        enrollment, created = ClassEnrollment.objects.get_or_create(
            student=student,
            class_room=class_room
        )

        if created:
            log_activity(
                user=request.user,
                action="ADMIN_ENROLLED_STUDENT",
                description=f"Admin enrolled {student.email} into {class_room.name}"
            )

        return Response({"success": True, "message": "Student enrolled successfully."})


# ══════════════════════════════════════════════════════════════════════════════
# DEPARTMENT, PROGRAMME, COURSE STREAM VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class DepartmentListView(generics.GenericAPIView):
    """
    GET /api/classes/departments/

    Returns all active departments with their programme and stream counts.
    Permission: IsAuthenticated
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        """Return departments with annotated counts."""
        depts = Department.objects.filter(is_active=True).annotate(
            streams_count=Count('streams'),
            programmes_count=Count('programmes'),
        )
        data = [
            {
                "id": dept.id,
                "code": dept.code,
                "name": dept.name,
                "description": dept.description,
                "is_active": dept.is_active,
                "streams_count": dept.streams_count,
                "programmes_count": dept.programmes_count,
            }
            for dept in depts
        ]
        return Response({"success": True, "data": data})


class ProgrammeListView(generics.ListAPIView):
    """
    GET /api/classes/programmes/

    Returns all active programmes. Supports filtering:
    - ?department_code=CS  → filter by department code
    - ?department=<id>     → filter by department ID

    Permission: IsAuthenticated
    """
    permission_classes = [AllowAny]
    serializer_class = ProgrammeSerializer

    def get_queryset(self):
        """Return active programmes with optional department filtering."""
        qs = Programme.objects.filter(is_active=True).select_related('department')

        dept_code = self.request.query_params.get('department_code')
        if dept_code:
            qs = qs.filter(department__code=dept_code)

        dept_id = self.request.query_params.get('department')
        if dept_id:
            qs = qs.filter(department_id=dept_id)

        return qs.order_by('department', 'code')

    def list(self, request, *args, **kwargs):
        """Wrap the list response in our API envelope."""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


class CourseStreamListView(generics.GenericAPIView):
    """
    GET /api/classes/streams/

    Returns all active streams. Supports filtering:
    - ?department_code=CS  → filter by department
    - ?programme=<id>      → filter by programme ID
    - ?programme_code=BCOE → filter by programme code
    - ?year_of_study=2     → filter by year

    Permission: IsAuthenticated
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        """Return streams grouped by department."""
        qs = CourseStream.objects.filter(
            is_active=True
        ).select_related('department', 'programme')

        dept_code = request.query_params.get('department_code')
        if dept_code:
            qs = qs.filter(department__code=dept_code)

        programme_id = request.query_params.get('programme')
        if programme_id:
            qs = qs.filter(programme_id=programme_id)

        programme_code = request.query_params.get('programme_code')
        if programme_code:
            qs = qs.filter(programme__code=programme_code)

        year = request.query_params.get('year_of_study')
        if year:
            qs = qs.filter(year_of_study=year)

        grouped_data = {}
        for s in qs:
            dept = s.department
            if dept and dept.code not in grouped_data:
                grouped_data[dept.code] = {
                    "department": dept.name,
                    "streams": []
                }
            if dept:
                grouped_data[dept.code]["streams"].append({
                    "id": s.id,
                    "code": s.code,
                    "name": s.name,
                    "programme": s.programme.code if s.programme else '',
                    "programme_name": s.programme.name if s.programme else '',
                    "year_of_study": s.year_of_study,
                    "group_number": s.group_number
                })

        return Response({"success": True, "data": grouped_data})


# ── Admin Stream Management ─────────────────────────────────────────────────

class AdminStreamCreateView(generics.GenericAPIView):
    """
    POST /api/admin/classes/streams/

    Admin-only endpoint to create a new CourseStream.
    Required fields: code, name, department, programme, year_of_study.
    Permission: IsAuthenticated + IsAdmin
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, *args, **kwargs):
        """Create a new course stream."""
        required = ['code', 'name', 'department', 'year_of_study']
        for field in required:
            if not request.data.get(field):
                return Response(
                    {"success": False, "message": f"'{field}' is required."},
                    status=400
                )

        code = request.data['code'].strip()
        if CourseStream.objects.filter(code=code).exists():
            return Response(
                {"success": False, "message": f"Stream with code '{code}' already exists."},
                status=400
            )

        # Resolve department
        dept_data = request.data['department']
        try:
            if isinstance(dept_data, int) or str(dept_data).isdigit():
                dept = Department.objects.get(id=int(dept_data))
            else:
                dept = Department.objects.get(code=dept_data)
        except Department.DoesNotExist:
            try:
                dept = Department.objects.get(name=dept_data)
            except Department.DoesNotExist:
                return Response(
                    {"success": False, "message": f"Department '{dept_data}' not found."},
                    status=400
                )

        # Resolve programme (optional)
        prog = None
        prog_data = request.data.get('programme')
        if prog_data:
            try:
                if isinstance(prog_data, int) or str(prog_data).isdigit():
                    prog = Programme.objects.get(id=int(prog_data))
                else:
                    prog = Programme.objects.get(code=prog_data)
            except Programme.DoesNotExist:
                try:
                    prog = Programme.objects.get(name=prog_data)
                except Programme.DoesNotExist:
                    return Response(
                        {"success": False, "message": f"Programme '{prog_data}' not found."},
                        status=400
                    )

        stream = CourseStream.objects.create(
            department=dept,
            programme=prog,
            code=code,
            name=request.data['name'],
            year_of_study=int(request.data['year_of_study']),
            group_number=int(request.data.get('group_number', 1)),
            is_active=request.data.get('is_active', True),
        )

        log_activity(
            user=request.user,
            action="STREAM_CREATED",
            description=f"Admin created course stream: {stream}"
        )

        serializer = DRFCourseStreamSerializer(stream)
        return Response(
            {"success": True, "data": serializer.data, "message": "Course stream created."},
            status=201
        )


class AdminStreamUpdateView(generics.GenericAPIView):
    """
    PATCH /api/admin/classes/streams/<id>/

    Admin-only endpoint to update a CourseStream.
    Accepts partial updates.
    Permission: IsAuthenticated + IsAdmin
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, *args, **kwargs):
        """Partially update a course stream."""
        try:
            stream = CourseStream.objects.get(pk=self.kwargs['pk'])
        except CourseStream.DoesNotExist:
            return Response({"success": False, "message": "Stream not found."}, status=404)

        allowed = ['name', 'department', 'programme', 'year_of_study', 'is_active', 'group_number']
        for field in allowed:
            if field in request.data:
                if field == 'department':
                    dept_data = request.data['department']
                    try:
                        if isinstance(dept_data, int) or str(dept_data).isdigit():
                            dept = Department.objects.get(id=int(dept_data))
                        else:
                            dept = Department.objects.get(code=dept_data)
                    except Department.DoesNotExist:
                        try:
                            dept = Department.objects.get(name=dept_data)
                        except Department.DoesNotExist:
                            return Response(
                                {"success": False, "message": f"Department '{dept_data}' not found."},
                                status=400
                            )
                    stream.department = dept
                elif field == 'programme':
                    prog_data = request.data['programme']
                    try:
                        if isinstance(prog_data, int) or str(prog_data).isdigit():
                            prog = Programme.objects.get(id=int(prog_data))
                        else:
                            prog = Programme.objects.get(code=prog_data)
                    except Programme.DoesNotExist:
                        try:
                            prog = Programme.objects.get(name=prog_data)
                        except Programme.DoesNotExist:
                            return Response(
                                {"success": False, "message": f"Programme '{prog_data}' not found."},
                                status=400
                            )
                    stream.programme = prog
                else:
                    setattr(stream, field, request.data[field])
        stream.save()

        log_activity(
            user=request.user,
            action="STREAM_UPDATED",
            description=f"Admin updated course stream: {stream}"
        )

        serializer = DRFCourseStreamSerializer(stream)
        return Response(
            {"success": True, "data": serializer.data, "message": "Course stream updated."}
        )



