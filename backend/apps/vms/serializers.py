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
        return f"{obj.owner.email} ({obj.owner.first_name} {obj.owner.last_name})"

    def get_can_connect(self, obj):
        return obj.status == 'running'

    def get_uptime_seconds(self, obj):
        if obj.started_at and obj.status == 'running':
            return int((timezone.now() - obj.started_at).total_seconds())
        return 0

class VMRequestSerializer(serializers.Serializer):
    template_id = serializers.IntegerField(write_only=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        user = self.context['request'].user
        # Check if user already has an active VM
        has_active = VirtualMachine.objects.filter(
            owner=user,
            status__in=['provisioning', 'running']
        ).exists()

        if has_active:
            raise serializers.ValidationError("You already have an active VM. Stop it before requesting a new one.")
        
        return data
