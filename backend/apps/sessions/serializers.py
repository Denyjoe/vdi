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
            'restrictions', 'duration_hours', 'scheduled_at', 'hours_purchased',
            'amount_paid_tzs', 'scheduled_end_at', 'auto_ended'
        ]
        read_only_fields = ['host', 'invite_code', 'invite_link', 'status', 'scheduled_end_at']

class SessionParticipantSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    vm_status = serializers.CharField(source='vm.status', read_only=True)
    guacamole_url = serializers.SerializerMethodField()
    guac_connected = serializers.SerializerMethodField()
    session_scheduled_end_at = serializers.DateTimeField(source='session.scheduled_end_at', read_only=True)

    class Meta:
        model = SessionParticipant
        fields = [
            'id', 'user', 'vm', 'vm_status', 'guacamole_url', 'guac_connected', 'status', 'joined_at',
            'submitted_at', 'submission_file', 'vm_snapshot_id', 'session_scheduled_end_at',
            'is_being_controlled',
        ]

    def get_guacamole_url(self, obj):
        if not obj.vm or not obj.vm.guacamole_connection_id:
            return None
        try:
            from apps.vms.services.guacamole_service import get_guacamole_service
            gs = get_guacamole_service()
            return gs.get_connection_url(obj.vm.guacamole_connection_id)
        except Exception:
            return None

    def get_guac_connected(self, obj):
        """Whether Guacamole currently has a live tunnel for this participant's VM.

        This is the only genuine signal for an in-guest OS reboot/shutdown —
        confirmed by direct testing that Proxmox VM status stays 'running'
        throughout an in-guest reboot while Guacamole's activeConnections
        entry disappears within the same polling cycle.
        """
        if not obj.vm or not obj.vm.guacamole_connection_id:
            return False
        try:
            from apps.vms.services.guacamole_service import get_guacamole_service
            gs = get_guacamole_service()
            return gs.get_active_connection_id(obj.vm.guacamole_connection_id) is not None
        except Exception:
            return False
