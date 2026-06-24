"""
Admin registration for the users application.

Extends the default UserAdmin so that DIT-specific fields (role,
student_id, phone, avatar, is_approved) appear in the Django admin panel.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Custom admin view for the DIT User model.

    Adds DIT-specific fields to the standard UserAdmin fieldsets so that
    administrators can view and edit role, student ID, phone, avatar, and
    approval status directly from the admin panel.
    """

    # Columns shown in the user list view
    list_display = (
        "username", "email", "get_full_name", "role",
        "student_id", "is_approved", "is_active", "created_at",
    )
    list_filter = ("role", "is_approved", "is_active", "is_staff")
    search_fields = ("username", "email", "first_name", "last_name", "student_id")
    ordering = ("-created_at",)

    # Add DIT-specific fields to the bottom of the standard fieldsets
    fieldsets = BaseUserAdmin.fieldsets + (
        ("DIT VDI Profile", {
            "fields": ("role", "student_id", "phone", "avatar", "is_approved"),
        }),
    )

    # Show DIT fields when creating a new user via admin
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("DIT VDI Profile", {
            "fields": ("role", "student_id", "phone", "is_approved"),
        }),
    )
