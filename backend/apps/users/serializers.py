from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from rest_framework.exceptions import ValidationError

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serialises a full user profile for the profile page.

    The `stream` field is returned as a nested object (id, code, name,
    department, year_of_study) instead of a raw FK integer, so the
    frontend can display the stream name without a second request.
    """
    stream = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'role',
            'student_id', 'phone', 'avatar', 'is_approved', 'created_at',
            'department', 'year_of_study', 'stream',
        ]
        read_only_fields = [
            'id', 'first_name', 'last_name', 'email', 'role',
            'student_id', 'is_approved', 'created_at',
        ]

    def get_stream(self, obj):
        """Return stream as a structured object, or None if not assigned."""
        if obj.stream_id is None:
            return None
        s = obj.stream
        return {
            'id': s.id,
            'code': s.code,
            'name': s.name,
            'department': s.department,
            'year_of_study': s.year_of_study,
        }


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'password', 'confirm_password', 'role', 'student_id']

    def validate_role(self, value):
        valid_roles = [User.Role.STUDENT, User.Role.LECTURER, User.Role.ADMIN]
        if value not in valid_roles:
            raise serializers.ValidationError(f"Role must be one of: {', '.join(valid_roles)}")
        return value

    def validate(self, data):
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({"password": "Passwords do not match."})
        
        role = data.get('role')
        student_id = data.get('student_id')
        if role == User.Role.STUDENT and not student_id:
            raise serializers.ValidationError({"student_id": "Student ID is required for students."})
        
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        # Map email to username as required by AbstractUser if username field is retained
        validated_data['username'] = validated_data['email']
        user = User.objects.create_user(**validated_data)
        return user

from apps.sessions.models import ActivityLog

class ActivityLogSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.email', read_only=True)
    description = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = ['id', 'user', 'action', 'description', 'timestamp', 'metadata', 'ip_address']

    def get_description(self, obj):
        # A simple formatter for the action
        action_map = {
            'LOGIN_SUCCESS': 'User logged in successfully',
            'LOGIN_FAILED': 'Failed login attempt',
            'LOGOUT': 'User logged out',
            'USER_DEACTIVATED': 'User account deactivated',
            'USER_ACTIVATED': 'User account activated',
        }
        return action_map.get(obj.action, obj.action)

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')
        
        if email and password:
            # We map username to email in our system
            user = authenticate(request=self.context.get('request'), username=email, password=password)
            if not user:
                raise serializers.ValidationError("Invalid email or password.", code='authorization')
        else:
            raise serializers.ValidationError("Must include 'email' and 'password'.", code='authorization')
            
        data['user'] = user
        return data

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_new_password = serializers.CharField(required=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is not correct")
        return value

    def validate(self, data):
        if data['new_password'] != data['confirm_new_password']:
            raise serializers.ValidationError({"new_password": "New passwords do not match"})
        return data
