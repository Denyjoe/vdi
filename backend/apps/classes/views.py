from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from apps.users.permissions import IsLecturer, IsAdmin, IsStudent
from apps.users.models import User
from .models import Class, ClassEnrollment, EnrollmentRequest
from .serializers import ClassSerializer, ClassEnrollmentSerializer, EnrollmentRequestSerializer
from apps.sessions.models import ActivityLog
from django.db.models import Exists, OuterRef, Prefetch

def log_activity(user, action, description, ip_address=None):
    ActivityLog.objects.create(
        user=user,
        action=action,
        description=description,
        ip_address=ip_address
    )

class MyClassesView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = ClassSerializer

    def get_queryset(self):
        return Class.objects.filter(lecturer=self.request.user).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

class ClassDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ClassSerializer

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Class.objects.all()
        elif self.request.user.role == 'lecturer':
            return Class.objects.filter(lecturer=self.request.user)
        else:
            return Class.objects.filter(enrollments__student=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        
        enrollments = instance.enrollments.all()
        enrollment_serializer = ClassEnrollmentSerializer(enrollments, many=True)
        data['enrolled_students'] = enrollment_serializer.data
        
        return Response({"success": True, "data": data})

class ClassEnrollmentListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ClassEnrollmentSerializer

    def get_queryset(self):
        class_id = self.kwargs['pk']
        return ClassEnrollment.objects.filter(class_room_id=class_id).order_by('-enrolled_at')
        
    def list(self, request, *args, **kwargs):
        class_room = Class.objects.filter(id=self.kwargs['pk']).first()
        if not class_room:
            return Response({"success": False, "message": "Class not found"}, status=404)
            
        if request.user.role != 'admin' and class_room.lecturer != request.user:
            return Response({"success": False, "message": "Not authorized"}, status=403)
            
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

class AdminClassListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = ClassSerializer

    def get_queryset(self):
        return Class.objects.all().order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

class StudentEnrolledClassesView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = ClassSerializer

    def get_queryset(self):
        return Class.objects.filter(
            enrollments__student=self.request.user,
            is_active=True
        ).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

# --- NEW VIEWS FOR FEATURE 1 ---

# 1. Lecturer Views
class LecturerCreateClassView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = ClassSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        class_room = serializer.save(lecturer=request.user)
        
        log_activity(
            user=request.user,
            action="CLASS_CREATED",
            description=f"Lecturer created class: {class_room.name}"
        )
        
        return Response({"success": True, "data": serializer.data, "message": "Class created successfully."}, status=201)

class LecturerUpdateClassView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = ClassSerializer
    
    def get_queryset(self):
        return Class.objects.filter(lecturer=self.request.user)

    def update(self, request, *args, **kwargs):
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

class LecturerEnrollmentRequestsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]
    serializer_class = EnrollmentRequestSerializer

    def get_queryset(self):
        class_id = self.kwargs['pk']
        qs = EnrollmentRequest.objects.filter(class_room_id=class_id, class_room__lecturer=self.request.user)
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by('-requested_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

class LecturerApproveEnrollmentView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsLecturer]

    def post(self, request, *args, **kwargs):
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
    permission_classes = [IsAuthenticated, IsLecturer]

    def post(self, request, *args, **kwargs):
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
    permission_classes = [IsAuthenticated, IsLecturer]

    def delete(self, request, *args, **kwargs):
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

# 2. Student Views
class StudentAvailableClassesView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = ClassSerializer

    def get_queryset(self):
        user = self.request.user
        # All active classes where student is NOT enrolled
        return Class.objects.filter(is_active=True).exclude(
            enrollments__student=user
        ).order_by('department', 'name')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        # Annotate with whether they have a pending/rejected request
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
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, *args, **kwargs):
        class_id = self.kwargs['pk']
        try:
            class_room = Class.objects.get(id=class_id, is_active=True)
        except Class.DoesNotExist:
            return Response({"success": False, "message": "Class not found or inactive."}, status=404)
            
        if ClassEnrollment.objects.filter(student=request.user, class_room=class_room).exists():
            return Response({"success": False, "message": "Already enrolled."}, status=400)
            
        if EnrollmentRequest.objects.filter(student=request.user, class_room=class_room, status='pending').exists():
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
        return Response({"success": True, "data": serializer.data, "message": "Enrollment request sent."})

class StudentCancelRequestView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def delete(self, request, *args, **kwargs):
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
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = EnrollmentRequestSerializer

    def get_queryset(self):
        return EnrollmentRequest.objects.filter(student=self.request.user).order_by('-requested_at')
        
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

# 3. Admin Views
class AdminCreateClassView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = ClassSerializer

    def create(self, request, *args, **kwargs):
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
        
        return Response({"success": True, "data": serializer.data, "message": "Class created successfully."}, status=201)

class AdminEnrollStudentView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, *args, **kwargs):
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
