from rest_framework import serializers
from .models import LiveSession, SessionParticipant
from apps.users.serializers import UserProfileSerializer

class LiveSessionSerializer(serializers.ModelSerializer):
    host_details = UserProfileSerializer(source='host', read_only=True)
    participant_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = LiveSession
        fields = [
            'id', 'name', 'description', 'host', 'host_details', 'group',
            'session_type', 'required_vm_template', 'invite_code', 'invite_link',
            'is_public', 'is_exam_mode', 'max_participants', 'start_time',
            'end_time', 'submission_deadline', 'restrict_internet',
            'restrict_copy_paste', 'allow_late_submission', 'submission_type',
            'instructions', 'status', 'created_at', 'participant_count'
        ]
        read_only_fields = ['host', 'invite_code', 'invite_link', 'status']

class SessionParticipantSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = SessionParticipant
        fields = [
            'id', 'user', 'vm', 'status', 'joined_at',
            'submitted_at', 'submission_file', 'vm_snapshot_id'
        ]
