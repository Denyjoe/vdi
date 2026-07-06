from rest_framework import serializers
from .models import LiveSession, SessionParticipant
from apps.users.serializers import UserProfileSerializer

class LiveSessionSerializer(serializers.ModelSerializer):
    host_details = UserProfileSerializer(source='host', read_only=True)
    participant_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = LiveSession
        fields = [
            'id', 'name', 'description', 'host', 'host_details',
            'session_type', 'required_vm_template', 'invite_code', 'invite_link',
            'is_public', 'is_exam_mode', 'max_participants', 'start_time',
            'end_time', 'submission_deadline', 'restrict_internet',
            'restrict_copy_paste', 'allow_late_submission', 'submission_type',
            'instructions', 'status', 'created_at', 'participant_count',
            'password', 'allow_participant_chat', 'record_session', 'show_participant_list',
            'restrictions', 'duration_hours', 'scheduled_at'
        ]
        read_only_fields = ['host', 'invite_code', 'invite_link', 'status']

class SessionParticipantSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    vm_status = serializers.CharField(source='vm.status', read_only=True)
    guacamole_url = serializers.SerializerMethodField()
    
    class Meta:
        model = SessionParticipant
        fields = [
            'id', 'user', 'vm', 'vm_status', 'guacamole_url', 'status', 'joined_at',
            'submitted_at', 'submission_file', 'vm_snapshot_id'
        ]

    def get_guacamole_url(self, obj):
        if not obj.vm or not obj.vm.guacamole_connection_id:
            return None
        import base64
        from decouple import config
        guac_public = config('GUACAMOLE_PUBLIC_URL', default='http://192.168.1.4:8080/guacamole')
        identifier = f"{obj.vm.guacamole_connection_id}\x00c\x00postgresql"
        encoded = base64.b64encode(identifier.encode()).decode()
        return f"{guac_public}/#/client/{encoded}"
