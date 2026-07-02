from rest_framework import serializers
from .models import VMTemplate, VirtualMachine, Workspace

class VMTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VMTemplate
        fields = '__all__'

class VirtualMachineSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    
    class Meta:
        model = VirtualMachine
        fields = '__all__'

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
