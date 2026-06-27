from rest_framework import serializers
from django.utils import timezone
from .models import VMTemplate, VirtualMachine

class VMTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VMTemplate
        fields = ['id', 'name', 'description', 'cpu_cores', 'ram_gb', 
                  'storage_gb', 'software_list', 'os', 'icon', 
                  'is_available', 'created_at']
        read_only_fields = fields

class AdminVMTemplateSerializer(serializers.ModelSerializer):
    """
    Writable serializer for admin template management.
    Allows create/update of all template fields.
    """
    class Meta:
        model = VMTemplate
        fields = ['id', 'name', 'description', 'cpu_cores', 'ram_gb',
                  'storage_gb', 'software_list', 'os', 'icon',
                  'is_available', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_cpu_cores(self, value):
        """Ensure CPU cores are within the allowed range (1–32)."""
        if not 1 <= value <= 32:
            raise serializers.ValidationError("CPU cores must be between 1 and 32.")
        return value

    def validate_ram_gb(self, value):
        """Ensure RAM is within the allowed range (2–128 GB)."""
        if not 2 <= value <= 128:
            raise serializers.ValidationError("RAM must be between 2 and 128 GB.")
        return value

    def validate_storage_gb(self, value):
        """Ensure storage is within the allowed range (20–2000 GB)."""
        if not 20 <= value <= 2000:
            raise serializers.ValidationError("Storage must be between 20 and 2000 GB.")
        return value

    def validate_software_list(self, value):
        """Ensure software_list is a JSON array."""
        if not isinstance(value, list):
            raise serializers.ValidationError("software_list must be a JSON array.")
        return value


class VirtualMachineSerializer(serializers.ModelSerializer):
    template = VMTemplateSerializer(read_only=True)
    owner = serializers.SerializerMethodField()
    can_connect = serializers.SerializerMethodField()
    uptime_seconds = serializers.SerializerMethodField()

    class Meta:
        model = VirtualMachine
        fields = ['id', 'template', 'owner', 'name', 'status', 
                  'proxmox_vm_id', 'cpu_usage', 'ram_usage', 
                  'allocated_at', 'started_at', 'stopped_at', 'notes',
                  'can_connect', 'uptime_seconds']

    def get_owner(self, obj):
        """Return owner email and full name."""
        return f"{obj.owner.email} ({obj.owner.first_name} {obj.owner.last_name})"

    def get_can_connect(self, obj):
        """True only when the VM is running."""
        return obj.status == 'running'

    def get_uptime_seconds(self, obj):
        """Return seconds since VM started; 0 if not running."""
        if obj.started_at and obj.status == 'running':
            return int((timezone.now() - obj.started_at).total_seconds())
        return 0


class VMRequestSerializer(serializers.Serializer):
    """Validates a student's request to provision a new VM."""
    template_id = serializers.IntegerField(write_only=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        user = self.context['request'].user
        
        from apps.users.models import SystemSetting
        max_vms = int(SystemSetting.get('max_vms_per_student', '1'))

        # Block if student already has a provisioning or running VM
        active_count = VirtualMachine.objects.filter(
            owner=user,
            status__in=['provisioning', 'running']
        ).count()

        if active_count >= max_vms:
            raise serializers.ValidationError(
                f"You can only have {max_vms} active VM(s) at a time."
            )
        return data
