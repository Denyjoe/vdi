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
    is_host = models.BooleanField(default=False)
    host_plan = models.CharField(
        max_length=20,
        choices=[
            ('none', 'No Host Plan'),
            ('personal', 'Personal Host'),
            ('pro', 'Pro Host'),
            ('institution', 'Institution'),
        ],
        default='none'
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Contact phone number.",
    )
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
    referred_by = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='referrals'
    )
    is_approved = models.BooleanField(
        default=True,
        help_text="Unapproved accounts cannot log in. Admins control this.",
    )
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

    @property
    def subscription_plan(self):
        try:
            return self.subscription.plan.name
        except:
            return 'free'


class SystemSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True)
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "system_settings"
        verbose_name = "System Setting"
        verbose_name_plural = "System Settings"
        ordering = ["key"]

    def __str__(self):
        return f"{self.key} = {self.value}"

    @classmethod
    def get(cls, key, default=None):
        try:
            return cls.objects.get(key=key).value
        except cls.DoesNotExist:
            return default

    @classmethod
    def set(cls, key, value, user=None):
        obj, _ = cls.objects.update_or_create(
            key=key,
            defaults={
                'value': str(value),
                'updated_by': user
            }
        )
        return obj

class SubscriptionPlan(models.Model):
    PLAN_CHOICES = [
        ('free', 'Free'),
        ('personal_host', 'Personal Host'),
        ('pro_host', 'Pro Host'),
        ('institution', 'Institution'),
    ]
    name = models.CharField(
        max_length=50,
        choices=PLAN_CHOICES,
        unique=True)
    display_name = models.CharField(max_length=100)
    price_usd = models.DecimalField(
        max_digits=8, decimal_places=2,
        default=0)
    price_tzs = models.DecimalField(
        max_digits=12, decimal_places=0,
        default=0)
    compute_hours_per_month = models.IntegerField(
        default=5)
        # -1 means unlimited
    can_host_sessions = models.BooleanField(
        default=False)
    max_session_participants = models.IntegerField(
        default=0)
    features = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

class UserSubscription(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
        ('trial', 'Trial'),
    ]
    user = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name='subscription')
    plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.PROTECT)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active')
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        null=True, blank=True)
    compute_hours_used = models.FloatField(default=0)
    last_reset_at = models.DateTimeField(
        auto_now_add=True)

    @property
    def hours_remaining(self):
        plan_hours = self.plan.compute_hours_per_month
        if plan_hours == -1:
            return float('inf')
        return max(0,
            plan_hours - self.compute_hours_used)

    @property
    def is_valid(self):
        if self.status != 'active':
            return False
        if self.expires_at:
            from django.utils import timezone
            return timezone.now() < self.expires_at
        return True

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
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT)
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
        default='pending')
    created_at = models.DateTimeField(
        auto_now_add=True)
    completed_at = models.DateTimeField(
        null=True, blank=True)
    metadata = models.JSONField(default=dict)

    class Meta:
        ordering = ['-created_at']
