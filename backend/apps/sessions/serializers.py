from rest_framework import serializers
from django.utils import timezone
from .models import RemoteSession, ExamSession, ActivityLog

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
    class_room = serializers.CharField(source='class_room.name', read_only=True)
    lecturer = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    time_remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = ['id', 'name', 'class_room', 'lecturer', 'status', 'starts_at', 'ends_at',
                  'restrict_internet', 'restrict_copy_paste', 'created_at', 
                  'is_active', 'time_remaining_seconds']

    def get_lecturer(self, obj):
        return f"{obj.lecturer.first_name} {obj.lecturer.last_name} ({obj.lecturer.email})"

    def get_is_active(self, obj):
        return obj.status == 'active'

    def get_time_remaining_seconds(self, obj):
        if obj.status == 'active' and obj.ends_at:
            now = timezone.now()
            if obj.ends_at > now:
                return int((obj.ends_at - now).total_seconds())
        return 0


class ActivityLogSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.email', read_only=True, default=None)

    class Meta:
        model = ActivityLog
        fields = ['id', 'user', 'action', 'description', 'timestamp', 'ip_address']
