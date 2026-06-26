from rest_framework import serializers
from django.utils import timezone
from .models import RemoteSession, ExamSession, ActivityLog, PracticalSession, StudentPracticalAccess

class RemoteSessionSerializer(serializers.ModelSerializer):
    vm = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    duration_display = serializers.SerializerMethodField()

    class Meta:
        model = RemoteSession
        fields = ['id', 'vm', 'user', 'status', 'started_at', 'ended_at', 
                  'duration_seconds', 'ip_address', 'duration_display']

    def get_vm(self, obj):
        return {
            "id": obj.vm.id,
            "name": obj.vm.name,
            "template_name": obj.vm.template.name,
            "owner_email": obj.vm.owner.email,
            "os": obj.vm.template.os
        }

    def get_user(self, obj):
        return f"{obj.user.email} ({obj.user.first_name} {obj.user.last_name})"

    def get_duration_display(self, obj):
        if obj.duration_seconds == 0:
            return "Active"
        
        h = obj.duration_seconds // 3600
        m = (obj.duration_seconds % 3600) // 60
        s = obj.duration_seconds % 60
        
        parts = []
        if h > 0: parts.append(f"{h}h")
        if m > 0 or h > 0: parts.append(f"{m}m")
        parts.append(f"{s}s")
        
        return " ".join(parts)


class ExamSessionSerializer(serializers.ModelSerializer):
    class_room = serializers.SerializerMethodField()
    lecturer = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    time_remaining_seconds = serializers.SerializerMethodField()
    allowed_vm_template = serializers.SerializerMethodField()
    enrolled_student_count = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = ['id', 'name', 'class_room', 'lecturer', 'status', 'starts_at', 'ends_at',
                  'restrict_internet', 'restrict_copy_paste', 'instructions', 
                  'allowed_vm_template', 'grace_period_minutes', 'created_at', 
                  'is_active', 'time_remaining_seconds', 'enrolled_student_count']

    def get_class_room(self, obj):
        return {
            "id": obj.class_room.id,
            "name": obj.class_room.name
        }

    def get_lecturer(self, obj):
        return {
            "id": obj.lecturer.id,
            "full_name": f"{obj.lecturer.first_name} {obj.lecturer.last_name}".strip(),
            "email": obj.lecturer.email
        }

    def get_allowed_vm_template(self, obj):
        if obj.allowed_vm_template:
            return {
                "id": obj.allowed_vm_template.id,
                "name": obj.allowed_vm_template.name
            }
        return None

    def get_is_active(self, obj):
        return obj.status == 'active'

    def get_time_remaining_seconds(self, obj):
        if obj.status == 'active' and obj.ends_at:
            now = timezone.now()
            if obj.ends_at > now:
                return int((obj.ends_at - now).total_seconds())
        return 0

    def get_enrolled_student_count(self, obj):
        return obj.class_room.enrollments.count()


class ExamSessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamSession
        fields = ['name', 'class_room', 'starts_at', 'ends_at',
                  'restrict_internet', 'restrict_copy_paste', 'instructions',
                  'allowed_vm_template', 'grace_period_minutes']
        
    def validate(self, data):
        # Validate ends_at is after starts_at
        if 'starts_at' in data and 'ends_at' in data:
            if data['ends_at'] <= data['starts_at']:
                raise serializers.ValidationError({"ends_at": "End time must be after start time."})
        
        # Validate class_room belongs to request.user (lecturer)
        request = self.context.get('request')
        if request and request.user:
            if 'class_room' in data:
                if data['class_room'].lecturer != request.user:
                    raise serializers.ValidationError({"class_room": "You can only create exams for your own classes."})
                    
        return data


class LiveStudentSessionSerializer(serializers.Serializer):
    """Serializer for the lecturer monitor view live sessions table.

    Outputs nested `user` and `vm` objects so the frontend can access
    session.user.full_name, session.vm.name etc. directly.
    """
    id = serializers.IntegerField()
    user = serializers.SerializerMethodField()
    vm = serializers.SerializerMethodField()
    status = serializers.CharField()
    started_at = serializers.DateTimeField()
    duration_seconds = serializers.IntegerField()
    ip_address = serializers.CharField()
    is_in_exam = serializers.SerializerMethodField()

    def get_user(self, obj):
        return {
            "id": obj.user.id,
            "full_name": f"{obj.user.first_name} {obj.user.last_name}".strip(),
            "email": obj.user.email,
            "username": obj.user.username,
        }

    def get_vm(self, obj):
        return {
            "id": obj.vm.id,
            "name": obj.vm.name,
            "template_name": obj.vm.template.name,
        }

    def get_is_in_exam(self, obj):
        # active_exams injected via serializer context to avoid N+1 queries
        active_exams = self.context.get('active_exams', [])
        for exam in active_exams:
            if exam.class_room.enrollments.filter(student_id=obj.user.id).exists():
                return True
        return False


class ActivityLogSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.email', read_only=True, default=None)

    class Meta:
        model = ActivityLog
        fields = ['id', 'user', 'action', 'description', 'timestamp', 'ip_address']


class PracticalSessionSerializer(serializers.ModelSerializer):
    """
    Serializer for PracticalSession with nested lecturer and class info.
    """
    lecturer_name = serializers.SerializerMethodField()
    class_name = serializers.CharField(source='class_room.name', read_only=True)
    vm_template_name = serializers.CharField(
        source='required_vm_template.name', read_only=True, default=''
    )
    attendance_count = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = PracticalSession
        fields = [
            'id', 'name', 'session_type', 'class_room', 'class_name', 'lecturer',
            'lecturer_name', 'required_vm_template', 'vm_template_name', 'submission_type',
            'scheduled_date', 'start_time', 'end_time', 'status',
            'instructions', 'max_concurrent_vms', 'auto_terminate',
            'attendance_count', 'total_students', 'created_at',
        ]

    def get_lecturer_name(self, obj):
        return f"{obj.lecturer.first_name} {obj.lecturer.last_name}".strip()

    def get_attendance_count(self, obj):
        return obj.student_access.filter(has_attended=True).count()

    def get_total_students(self, obj):
        return obj.student_access.count()


class StudentPracticalAccessSerializer(serializers.ModelSerializer):
    """
    Serializer for StudentPracticalAccess with nested student info.
    """
    student_name = serializers.SerializerMethodField()
    student_email = serializers.CharField(source='student.email', read_only=True)
    session_name = serializers.CharField(
        source='practical_session.name', read_only=True
    )

    class Meta:
        model = StudentPracticalAccess
        fields = [
            'id', 'practical_session', 'session_name', 'student',
            'student_name', 'student_email', 'has_attended',
            'joined_at', 'left_at', 'submission_file', 'submitted_at',
            'grade', 'lecturer_notes',
        ]

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}".strip()
