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

    class Meta:
        model = VirtualMachine
        fields = '__all__'

    def get_guacamole_url(self, obj):
        if not obj.guacamole_connection_id:
            return None
        import base64
        from decouple import config
        guac_public = config(
            'GUACAMOLE_PUBLIC_URL',
            default='http://192.168.1.4:8080/guacamole'
        )
        identifier = f"{obj.guacamole_connection_id}\x00c\x00postgresql"
        encoded = base64.b64encode(identifier.encode()).decode()
        return f"{guac_public}/#/client/{encoded}"

class WorkspaceSerializer(serializers.ModelSerializer):
    vm_template_details = VMTemplateSerializer(source='vm_template', read_only=True)
    vm_details = VirtualMachineSerializer(source='vm', read_only=True)
    
    class Meta:
        model = Workspace
        fields = [
            'id', 'owner', 'name', 'vm_template', 'vm_template_details',
            'vm', 'vm_details', 'status', 'compute_hours_used',
            'last_accessed_at', 'created_at'
        ]
        read_only_fields = ['owner', 'vm', 'status', 'compute_hours_used', 'last_accessed_at']
