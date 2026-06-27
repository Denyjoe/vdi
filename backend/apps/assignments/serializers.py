import os
from rest_framework import serializers
from django.utils import timezone
from .models import File, Assignment, Submission

class FileSerializer(serializers.ModelSerializer):
    class_room = serializers.SerializerMethodField()
    uploader = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    file_extension = serializers.SerializerMethodField()
    file_size_display = serializers.SerializerMethodField()

    class Meta:
        model = File
        fields = ['id', 'class_room', 'uploader', 'title', 'file', 'description', 
                  'uploaded_at', 'file_size', 'file_url', 'file_extension', 'file_size_display']

    def get_class_room(self, obj):
        return {
            "id": obj.class_room.id,
            "name": obj.class_room.name
        }

    def get_uploader(self, obj):
        return {
            "full_name": f"{obj.uploader.first_name} {obj.uploader.last_name}".strip(),
            "email": obj.uploader.email
        }

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

    def get_file_extension(self, obj):
        if obj.file and obj.file.name:
            _, ext = os.path.splitext(obj.file.name)
            return ext.lstrip('.').upper()
        return ""

    def get_file_size_display(self, obj):
        """Return a human-readable file size string.

        Returns:
            str: Size formatted as B / KB / MB, or 'Unknown' if not recorded.
        """
        size = obj.file_size
        if not size or size == 0:
            return "Unknown"
        if size < 1024:
            return f"{size} B"
        if size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        return f"{size / (1024 * 1024):.1f} MB"


class AssignmentSerializer(serializers.ModelSerializer):
    class_room = serializers.SerializerMethodField()
    lecturer = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    time_until_due = serializers.SerializerMethodField()
    submission_count = serializers.SerializerMethodField()

    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = ['id', 'class_room', 'lecturer', 'title', 'description', 'due_date',
                  'created_at', 'is_active', 'max_file_size_mb', 'is_overdue', 
                  'time_until_due', 'submission_count', 'attachment_url']

    def get_class_room(self, obj):
        return {
            "id": obj.class_room.id,
            "name": obj.class_room.name
        }

    def get_lecturer(self, obj):
        return {
            "full_name": f"{obj.lecturer.first_name} {obj.lecturer.last_name}".strip(),
            "email": obj.lecturer.email
        }

    def get_is_overdue(self, obj):
        return obj.is_active and obj.due_date < timezone.now()

    def get_time_until_due(self, obj):
        now = timezone.now()
        if obj.due_date < now:
            diff = now - obj.due_date
            days = diff.days
            return f"Overdue by {days} day{'s' if days != 1 else ''}"
        else:
            diff = obj.due_date - now
            days = diff.days
            hours = diff.seconds // 3600
            if days > 0:
                return f"{days} day{'s' if days != 1 else ''} {hours} hour{'s' if hours != 1 else ''} remaining"
            elif hours > 0:
                minutes = (diff.seconds % 3600) // 60
                return f"{hours} hour{'s' if hours != 1 else ''} {minutes} minute{'s' if minutes != 1 else ''} remaining"
            else:
                minutes = diff.seconds // 60
                return f"{minutes} minute{'s' if minutes != 1 else ''} remaining"

    def get_submission_count(self, obj):
        return obj.submissions.count()

    def get_attachment_url(self, obj):
        request = self.context.get('request')
        if obj.attachment and hasattr(obj.attachment, 'url'):
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None


class AssignmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = ['class_room', 'title', 'description', 'due_date', 'max_file_size_mb', 'attachment']
        
    def validate(self, data):
        request = self.context.get('request')
        
        if 'class_room' in data and request and request.user:
            if data['class_room'].lecturer != request.user:
                raise serializers.ValidationError({"class_room": "You can only create assignments for your own classes."})
                
        if 'due_date' in data:
            if data['due_date'] <= timezone.now():
                raise serializers.ValidationError({"due_date": "Due date must be in the future."})
                
        return data


class SubmissionSerializer(serializers.ModelSerializer):
    assignment = serializers.SerializerMethodField()
    student = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    file_size_display = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = ['id', 'assignment', 'student', 'file', 'submitted_at', 'is_late', 'notes',
                  'file_url', 'file_size_display', 'file_name']

    def get_assignment(self, obj):
        return {
            "title": obj.assignment.title,
            "due_date": obj.assignment.due_date
        }

    def get_student(self, obj):
        return {
            "full_name": f"{obj.student.first_name} {obj.student.last_name}".strip(),
            "email": obj.student.email,
            "student_id": obj.student.student_id
        }

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

    def get_file_size_display(self, obj):
        if not obj.file:
            return "0 KB"
        try:
            size = obj.file.size
            if size < 1024 * 1024:
                return f"{size / 1024:.0f} KB"
            return f"{size / (1024 * 1024):.1f} MB"
        except (ValueError, OSError):
            return "0 KB"

    def get_file_name(self, obj):
        if obj.file and obj.file.name:
            return os.path.basename(obj.file.name)
        return ""


class SubmissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ['assignment', 'file', 'notes']
        
    def validate(self, data):
        assignment = data.get('assignment')
        file = data.get('file')
        request = self.context.get('request')
        
        if not assignment.is_active:
            raise serializers.ValidationError({"assignment": "This assignment is no longer active."})
            
        if request and request.user:
            if Submission.objects.filter(assignment=assignment, student=request.user).exists():
                raise serializers.ValidationError("You have already submitted this assignment")
                
        if file and assignment.max_file_size_mb:
            max_size_bytes = assignment.max_file_size_mb * 1024 * 1024
            if file.size > max_size_bytes:
                raise serializers.ValidationError({"file": f"File size exceeds the maximum allowed size of {assignment.max_file_size_mb}MB."})
                
        return data
