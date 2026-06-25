from rest_framework import serializers
from .models import Class, ClassEnrollment, EnrollmentRequest

class ClassEnrollmentSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    class_room = serializers.CharField(source='class_room.name', read_only=True)

    class Meta:
        model = ClassEnrollment
        fields = ['id', 'student', 'class_room', 'enrolled_at']

    def get_student(self, obj):
        return {
            "name": f"{obj.student.first_name} {obj.student.last_name}".strip(),
            "email": obj.student.email,
            "student_id": obj.student.username, # using username as student_id
            "department": getattr(obj.student, 'department', ''),
            "year": getattr(obj.student, 'year', ''),
            "stream": getattr(obj.student, 'stream', '')
        }

class ClassSerializer(serializers.ModelSerializer):
    lecturer = serializers.SerializerMethodField()
    enrolled_count = serializers.SerializerMethodField()
    pending_requests_count = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = ['id', 'name', 'description', 'lecturer', 'department', 
                  'academic_year', 'stream', 'semester', 'max_students', 
                  'is_active', 'created_at', 'enrolled_count',
                  'pending_requests_count', 'is_enrolled']

    def get_lecturer(self, obj):
        return {
            "id": obj.lecturer.id,
            "name": f"{obj.lecturer.first_name} {obj.lecturer.last_name}".strip(),
            "email": obj.lecturer.email
        }

    def get_enrolled_count(self, obj):
        return obj.enrollments.count()

    def get_pending_requests_count(self, obj):
        return obj.enrollment_requests.filter(status='pending').count()

    def get_is_enrolled(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.role == 'student':
            return obj.enrollments.filter(student=request.user).exists()
        return False


class EnrollmentRequestSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    class_room_name = serializers.CharField(source='class_room.name', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EnrollmentRequest
        fields = ['id', 'student', 'class_room', 'class_room_name', 'status', 
                  'requested_at', 'reviewed_at', 'reviewed_by_name', 
                  'message', 'rejection_reason']

    def get_student(self, obj):
        return {
            "id": obj.student.id,
            "name": f"{obj.student.first_name} {obj.student.last_name}".strip(),
            "email": obj.student.email,
            "student_id": obj.student.username,
            "department": getattr(obj.student, 'department', ''),
            "year": getattr(obj.student, 'year', ''),
            "stream": getattr(obj.student, 'stream', '')
        }

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return f"{obj.reviewed_by.first_name} {obj.reviewed_by.last_name}".strip()
        return None
