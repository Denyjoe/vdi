from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.users.models import UserSubscription, SubscriptionPlan

User = get_user_model()

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = '__all__'

class UserSubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    display_name = serializers.CharField(source='plan.display_name', read_only=True)
    compute_hours_per_month = serializers.IntegerField(source='plan.compute_hours_per_month', read_only=True)
    can_host_sessions = serializers.BooleanField(source='plan.can_host_sessions', read_only=True)
    max_session_participants = serializers.IntegerField(source='plan.max_session_participants', read_only=True)

    class Meta:
        model = UserSubscription
        fields = [
            'plan_name', 'display_name', 'hours_remaining', 'compute_hours_used',
            'compute_hours_per_month', 'can_host_sessions', 'max_session_participants',
            'status', 'expires_at'
        ]

class UserProfileSerializer(serializers.ModelSerializer):
    subscription = UserSubscriptionSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'role', 'is_host', 'host_plan', 'avatar',
            'bio', 'website', 'country', 'timezone_preference', 'is_verified',
            'created_at', 'subscription'
        ]

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
        
        # Auto-create UserSubscription with Free plan
        try:
            free_plan = SubscriptionPlan.objects.get(name='free')
            UserSubscription.objects.create(user=user, plan=free_plan)
        except SubscriptionPlan.DoesNotExist:
            pass # Seed data should ensure 'free' plan exists
            
        return user
