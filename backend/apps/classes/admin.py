"""
Admin registration for the classes application.
"""

from django.contrib import admin

from .models import Class, ClassEnrollment


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    """Admin view for course/class records."""

    list_display = ("name", "lecturer", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "lecturer__username", "lecturer__email")
    ordering = ("-created_at",)


@admin.register(ClassEnrollment)
class ClassEnrollmentAdmin(admin.ModelAdmin):
    """Admin view for student-class enrollment records."""

    list_display = ("student", "class_room", "enrolled_at")
    list_filter = ("class_room",)
    search_fields = ("student__username", "class_room__name")
    ordering = ("-enrolled_at",)
