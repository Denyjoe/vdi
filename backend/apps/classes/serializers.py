from rest_framework import serializers
from .models import Group, GroupMembership
from apps.users.serializers import UserProfileSerializer

class GroupSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True, required=False)
    user_role_in_group = serializers.CharField(read_only=True, required=False)
    creator = UserProfileSerializer(source='created_by', read_only=True)

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'created_by', 'creator', 'group_type',
            'invite_code', 'invite_link', 'max_members', 'is_active',
            'tags', 'thumbnail', 'created_at', 'member_count', 'user_role_in_group'
        ]
        read_only_fields = ['created_by', 'invite_code', 'invite_link', 'is_active']

class GroupMembershipSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = GroupMembership
        fields = ['id', 'user', 'role_in_group', 'joined_at']
