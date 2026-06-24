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
        STUDENT = "student", "Student"
        LECTURER = "lecturer", "Lecturer"
        ADMIN = "admin", "Admin"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
        help_text="Determines which dashboard and permissions this user has.",
    )
    student_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        unique=True,
        help_text="DIT registration number (e.g. 230242498947). Students only.",
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
    def is_student(self):
        """Return True if this user has the student role."""
        return self.role == self.Role.STUDENT

    @property
    def is_lecturer(self):
        """Return True if this user has the lecturer role."""
        return self.role == self.Role.LECTURER

    @property
    def is_admin_user(self):
        """Return True if this user has the admin role."""
        return self.role == self.Role.ADMIN
