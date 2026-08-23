"""
Custom User model for the DIT VDI System.

Extends AbstractUser to add DIT-specific fields: role, student ID,
phone number, avatar, and approval status. Defining this model before
any migrations is critical — Django does not support swapping to a
custom User model after the first migration has been run.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    System-wide user account for the DIT VDI platform.

    Inherits all standard AbstractUser fields (username, email,
    password, first_name, last_name, is_active, etc.) and adds
    DIT-specific fields.

    Attributes:
        role (str): One of STUDENT, LECTURER, or ADMIN. Controls
            which dashboard and permissions the user sees.
        student_id (str): DIT registration number (optional).
        phone (str): Contact phone number (optional).
        avatar (ImageField): Profile photo stored in avatars/.
        is_approved (bool): Admins can deactivate accounts here.
        created_at (datetime): Timestamp set on account creation.
    """

    class Role(models.TextChoices):
        """Enumerated set of user roles within the VDI system."""
        USER = "user", "User"
        ADMIN = "admin", "Admin"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.USER,
        help_text="Determines which dashboard and permissions this user has.",
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Contact phone number.",
    )
    firebase_uid = models.CharField(
        max_length=128, blank=True,
        default='', unique=False)
    auth_provider = models.CharField(
        max_length=20, blank=True, default='',
        help_text="Which OAuth provider this account signed in with last "
                   "('google' or 'github'), from Firebase's own "
                   "sign_in_provider claim. Blank for accounts that "
                   "predate this field or never used Firebase.",
    )
    avatar_url = models.URLField(
        blank=True, default='')
    avatar = models.ImageField(
        upload_to="avatars/",
        blank=True,
        null=True,
        help_text="Profile photo. Stored in MEDIA_ROOT/avatars/.",
    )
    bio = models.TextField(blank=True)
    website = models.URLField(blank=True)
    country = models.CharField(
        max_length=100, blank=True,
        default='Tanzania'
    )
    timezone_preference = models.CharField(
        max_length=50,
        default='Africa/Dar_es_Salaam'
    )
    is_verified = models.BooleanField(default=False)
    verification_code = models.CharField(
        max_length=6, blank=True, default='')
    password_reset_code = models.CharField(
        max_length=6, blank=True, default='')
    password_reset_expires = models.DateTimeField(
        null=True, blank=True)
    referred_by = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='referrals'
    )
    is_approved = models.BooleanField(
        default=True,
        help_text="Unapproved accounts cannot log in. Admins control this.",
    )
    notification_email = models.BooleanField(default=True)
    notification_session = models.BooleanField(default=True)
    notification_usage = models.BooleanField(default=True)
    
    # New Notification Preferences
    notify_workspace_ready = models.BooleanField(default=True)
    notify_hours_low = models.BooleanField(default=True)
    notify_payment = models.BooleanField(default=True)
    notify_session_invite = models.BooleanField(default=True)
    notify_workspace_idle = models.BooleanField(default=True)
    notify_direct_message = models.BooleanField(default=True)

    # Suspension Fields
    is_suspended = models.BooleanField(default=False)
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspended_reason = models.TextField(blank=True, default='')
    suspended_by = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='suspended_users'
    )
    notify_announcements = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the account was first created.",
    )

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-created_at"]

    def __str__(self):
        """Return a human-readable representation of the user."""
        return f"{self.get_full_name() or self.username} ({self.role})"

    # ── Role helper properties ────────────────────────────────────────────────

    @property
    def is_user(self):
        return self.role == 'user'

    @property
    def is_admin(self):
        return self.role == 'admin'

import secrets
import hashlib
from django.utils import timezone

class APIToken(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name='api_token')
    
    key_hash = models.CharField(max_length=128, unique=True)
    key_prefix = models.CharField(max_length=20, help_text="First 8 chars for identification")
    
    name = models.CharField(max_length=100, default='Default')
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    last_used_ip = models.CharField(max_length=45, blank=True, default='')
    
    calls_today = models.IntegerField(default=0)
    calls_reset_at = models.DateTimeField(null=True, blank=True)
    
    can_read = models.BooleanField(default=True)
    can_write = models.BooleanField(default=True)
    can_delete = models.BooleanField(default=False)
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'API Token'
    
    def __str__(self):
        return f"API Token for {self.user.email} ({self.key_prefix}...)"
    
    @classmethod
    def generate_for_user(cls, user):
        cls.objects.filter(user=user).delete()
        plain_key = 'sk-cd-' + secrets.token_hex(24)
        key_hash = hashlib.sha256(plain_key.encode()).hexdigest()
        key_prefix = plain_key[:14]
        token = cls.objects.create(
            user=user,
            key_hash=key_hash,
            key_prefix=key_prefix,
        )
        return plain_key, token
    
    @classmethod
    def authenticate(cls, plain_key):
        if not plain_key or not plain_key.startswith('sk-cd-'):
            return None
        key_hash = hashlib.sha256(plain_key.encode()).hexdigest()
        try:
            token = cls.objects.get(key_hash=key_hash, is_active=True)
            now = timezone.now()
            if not token.calls_reset_at or token.calls_reset_at.date() < now.date():
                token.calls_today = 0
                token.calls_reset_at = now
            if token.calls_today >= 1000:
                return None
            token.calls_today += 1
            token.last_used_at = now
            token.save(update_fields=['last_used_at', 'calls_today', 'calls_reset_at'])
            return token.user
        except cls.DoesNotExist:
            return None


class ApiRequestLog(models.Model):
    """Genuine, minimal request history for the public API (apps/api/) —
    real per-request records, not the full partner-analytics dashboard.
    One row per real request actually served through a token, written in
    LoggedApiView.finalize_response() so every endpoint gets this for
    free without repeating the call site-by-site."""
    token = models.ForeignKey(
        'APIToken', on_delete=models.CASCADE, related_name='request_logs')
    endpoint = models.CharField(max_length=200)
    method = models.CharField(max_length=10)
    status_code = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.method} {self.endpoint} -> {self.status_code}'


class SystemConfig(models.Model):
    """Platform-wide settings managed 
    by admin from the dashboard"""
    key = models.CharField(
        max_length=100, unique=True)
    value = models.TextField(default='')
    
    class Meta:
        verbose_name = 'System Configuration'
    
    def __str__(self):
        return f"{self.key}: {self.value}"
    
    @classmethod
    def get(cls, key, default=''):
        try:
            return cls.objects.get(
                key=key).value
        except cls.DoesNotExist:
            return default
    
    @classmethod
    def set(cls, key, value):
        obj, _ = cls.objects.update_or_create(
            key=key,
            defaults={'value': str(value)})
        return obj


class ComputeUsageLog(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='usage_logs')
    vm = models.ForeignKey(
        'vms.VirtualMachine',
        on_delete=models.SET_NULL, null=True)
    session_type = models.CharField(max_length=50)
    hours_used = models.FloatField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    cost_usd = models.DecimalField(
        max_digits=8, decimal_places=4,
        default=0)

class Payment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    PROVIDER_CHOICES = [
        ('Mpesa', 'M-Pesa'),
        ('Airtel', 'Airtel Money'),
        ('Tigo', 'Tigo Pesa'),
        ('Halopesa', 'Halopesa'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='payments')
    amount_tzs = models.DecimalField(
        max_digits=12, decimal_places=2)
    amount_usd = models.DecimalField(
        max_digits=8, decimal_places=2,
        default=0)
    currency = models.CharField(
        max_length=3, default='TZS')
    provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        default='Mpesa')
    phone_number = models.CharField(max_length=15)
    transaction_id = models.CharField(
        max_length=100, unique=True)
    azampay_reference = models.CharField(
        max_length=200, blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True)
    payment_type = models.CharField(
        max_length=40,
        choices=[
            ('session_hosting', 'Session Hosting'),
            ('session_extend', 'Session Extend'),
            ('workspace_hours_purchase', 'Workspace Hours Purchase'),
            ('workspace_template_subscription', 'Workspace Template Subscription'),
        ],
        null=True, blank=True)
    created_at = models.DateTimeField(
        auto_now_add=True)
    completed_at = models.DateTimeField(
        null=True, blank=True)
    metadata = models.JSONField(default=dict)

    class Meta:
        ordering = ['-created_at']

class AdminActionLog(models.Model):
    admin = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, related_name='admin_actions')
    action_type = models.CharField(
        max_length=50,
        choices=[
            ('user_suspended', 'User Suspended'),
            ('user_reactivated', 'User Reactivated'),
            ('user_role_changed', 'User Role Changed'),
            ('template_created', 'Template Created'),
            ('template_updated', 'Template Updated'),
            ('template_deleted', 'Template Deleted'),
            ('price_changed', 'Price Changed'),
            ('vm_stopped', 'VM Force Stopped'),
            ('session_ended', 'Session Force Ended'),
            ('payment_refunded', 'Payment Refunded'),
            ('config_changed', 'System Config Changed'),
            ('backup_triggered', 'Backup Triggered'),
            ('maintenance_toggled', 'Maintenance Mode Toggled'),
            ('university_approved', 'University Approved'),
            ('university_rejected', 'University Rejected'),
            ('university_invoice_created', 'University Invoice Created'),
            ('university_invoice_status_changed', 'University Invoice Status Changed'),
            ('university_suspended', 'University Suspended'),
            ('university_reactivated', 'University Reactivated'),
            ('university_terms_updated', 'University Terms Updated'),
            ('university_deleted', 'University Deleted'),
        ])
    description = models.TextField()
    target_type = models.CharField(
        max_length=50, blank=True, default='')
    target_id = models.CharField(
        max_length=50, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Admin Action Log'
    
    def __str__(self):
        return f"{self.admin} - {self.action_type} - {self.created_at}"


class LoginAttempt(models.Model):
    email = models.CharField(max_length=255)
    success = models.BooleanField()
    ip_address = models.CharField(max_length=45, blank=True, default='')
    user_agent = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class UserSession(models.Model):
    """Device/browser metadata for a real login, correlated 1:1 with the
    SimpleJWT refresh+access token pair issued at that moment (via jti).

    SimpleJWT's own OutstandingToken (rest_framework_simplejwt.token_blacklist)
    is the actual source of truth for which sessions are live/revoked — this
    table only adds the human-readable context (device, IP, when) that
    OutstandingToken doesn't carry, and is looked up by jti alongside it.
    Populated going forward from FirebaseLoginView; sessions issued before
    this existed simply won't have a matching row here, and are shown
    honestly as "Unknown device" rather than guessed.
    """
    user = models.ForeignKey(
        'User', on_delete=models.CASCADE, related_name='login_sessions')
    refresh_jti = models.CharField(max_length=255, unique=True)
    access_jti = models.CharField(max_length=255, blank=True, default='')
    user_agent = models.CharField(max_length=255, blank=True, default='')
    ip_address = models.CharField(max_length=45, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
