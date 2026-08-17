from rest_framework import serializers
from .models import VMTemplate, VirtualMachine, Workspace

class VMTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VMTemplate
        fields = '__all__'

class VirtualMachineSerializer(serializers.ModelSerializer):
    """Serializer for VirtualMachine with computed guacamole_url."""

    template_name = serializers.CharField(source='template.name', read_only=True)
    guacamole_url = serializers.SerializerMethodField()
    guac_connected = serializers.SerializerMethodField()

    class Meta:
        model = VirtualMachine
        fields = '__all__'

    def get_guac_connected(self, obj):
        """Whether Guacamole currently has a live tunnel for this VM.

        Proxmox VM status stays 'running' through an in-guest OS reboot
        (confirmed by direct testing: qemu-guest-agent-triggered reboot
        left status='running' the entire time), so it can never detect
        an RDP session dying mid-reboot. Guacamole's own activeConnections
        list is the only genuine signal — it goes empty the instant the
        RDP tunnel drops and stays empty until a fresh connection is made.
        """
        if not obj.guacamole_connection_id:
            return False
        try:
            from .services.guacamole_service import get_guacamole_service
            gs = get_guacamole_service()
            return gs.get_active_connection_id(obj.guacamole_connection_id) is not None
        except Exception:
            return False

    def get_guacamole_url(self, obj):
        """Build a Guacamole client URL with a fresh auth token.

        Fetches a live auth token from the Guacamole API so the iframe
        auto-connects without showing the Guacamole login page.

        Args:
            obj: VirtualMachine instance.

        Returns:
            str or None: Full authenticated Guacamole client URL, or None
            if no connection exists.
        """
        if not obj.guacamole_connection_id:
            return None
        try:
            from .services.guacamole_service import get_guacamole_service
            gs = get_guacamole_service()
            return gs.get_connection_url(obj.guacamole_connection_id)
        except Exception:
            # Fallback: return URL without token (user will see Guac login)
            import base64
            from decouple import config
            guac_public = config(
                'GUACAMOLE_PUBLIC_URL',
                default='/guacamole'
            )
            identifier = f"{obj.guacamole_connection_id}\x00c\x00postgresql"
            encoded = base64.b64encode(identifier.encode()).decode()
            return f"{guac_public}/#/client/{encoded}"

class WorkspaceSerializer(serializers.ModelSerializer):
    vm_template_details = VMTemplateSerializer(source='vm_template', read_only=True)
    vm_details = VirtualMachineSerializer(source='vm', read_only=True)
    idle_warning = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = [
            'id', 'owner', 'name', 'vm_template', 'vm_template_details',
            'vm', 'vm_details', 'status', 'compute_hours_used',
            'last_accessed_at', 'created_at', 'access_reason', 'idle_warning'
        ]
        read_only_fields = ['owner', 'vm', 'status', 'compute_hours_used', 'last_accessed_at', 'access_reason']

    def get_idle_warning(self, obj):
        """Active idle-lifecycle warning for this workspace, if any.

        Returns None once the workspace is used again — the notification
        rows are historical and don't get deleted, but last_accessed_at
        moving past the relevant cutoff is what actually clears the badge.
        """
        from django.utils import timezone
        from apps.users.models import SystemConfig

        # Real N+1 found via a performance audit: calling .filter() on
        # obj.idle_notifications here always hits the DB fresh, even when
        # the view has prefetch_related'd this relation - reading from the
        # Prefetch(..., to_attr=...) result instead (when the view set it
        # up that way) avoids the per-row query; falls back to the direct
        # query for any caller that didn't prefetch.
        if hasattr(obj, 'prefetched_idle_notifications'):
            latest = obj.prefetched_idle_notifications[0] if obj.prefetched_idle_notifications else None
        else:
            latest = obj.idle_notifications.filter(
                notification_type__in=['first_warning', 'final_warning']
            ).order_by('-sent_at').first()
        if not latest:
            return None

        deletion_days = int(SystemConfig.get('workspace_idle_deletion_days', '30'))
        idle_days = (timezone.now() - obj.last_accessed_at).days
        days_remaining = max(0, deletion_days - idle_days)

        # The warning is only still "active" if the workspace hasn't been
        # used since — otherwise last_accessed_at would already be recent.
        cutoff_field = (
            'workspace_idle_warning_days' if latest.notification_type == 'first_warning'
            else 'workspace_idle_final_warning_days'
        )
        threshold_days = int(SystemConfig.get(cutoff_field, '23' if latest.notification_type == 'first_warning' else '29'))
        if idle_days < threshold_days:
            return None

        return {
            'level': latest.notification_type,
            'days_remaining': days_remaining,
        }
