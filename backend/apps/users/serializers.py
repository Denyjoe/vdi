from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'role', 'avatar',
            'bio', 'website', 'country', 'timezone_preference', 'is_verified',
            'notification_email', 'notification_session', 'notification_usage',
            'auth_provider', 'created_at', 'is_superuser',
        ]
        # Without this, ModelSerializer defaults every listed field to
        # writable — meaning UpdateProfileView (PUT/PATCH /auth/account/,
        # /auth/me/update/), which resolves get_object() to
        # self.request.user, would let any authenticated user PATCH their
        # OWN row's role straight to 'admin'. Confirmed exploitable before
        # this fix: a real 'user'-role test account PATCHed {'role':
        # 'admin'} against /auth/account/ and got a 200 with the change
        # genuinely persisted. id/email/auth_provider/is_verified/
        # created_at are identity/verification fields no self-service
        # profile update should ever be able to touch either.
        read_only_fields = ['id', 'email', 'role', 'is_verified', 'auth_provider', 'created_at', 'is_superuser']

    def get_avatar(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'password', 'confirm_password', 'country']
        extra_kwargs = {
            'country': {'required': False, 'default': 'Tanzania'}
        }

    def validate(self, data):
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        
        # Determine username from email
        username = validated_data.get('email').split('@')[0]
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
            
        validated_data['username'] = username

        user = User.objects.create_user(**validated_data)
        return user
