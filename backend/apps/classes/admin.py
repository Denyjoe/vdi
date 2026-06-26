"""
Admin registration for the classes application.
"""

from django.contrib import admin

from .models import (
    Class, ClassEnrollment, EnrollmentRequest,
    CourseStream, Department, Programme,
)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    """Admin view for DIT academic departments."""

    list_display = ("code", "name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    ordering = ("code",)


@admin.register(Programme)
class ProgrammeAdmin(admin.ModelAdmin):
    """Admin view for DIT academic programmes."""

    list_display = ("code", "name", "department", "level", "nta_range", "duration_years", "is_active")
    list_filter = ("department", "level", "is_active")
    search_fields = ("code", "name")
    ordering = ("department", "code")
    list_editable = ("is_active",)


@admin.register(CourseStream)
class CourseStreamAdmin(admin.ModelAdmin):
    """Admin view for DIT course stream records."""

    list_display = ("code", "name", "department", "programme", "year_of_study", "is_active")
    list_filter = ("department", "programme", "year_of_study", "is_active")
    search_fields = ("code", "name")
    ordering = ("department", "year_of_study", "code")
    list_editable = ("is_active",)


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    """Admin view for course/class records."""

    list_display = ("name", "lecturer", "department", "programme", "semester", "is_active", "created_at")
    list_filter = ("department", "programme", "semester", "is_active")
    search_fields = ("name", "lecturer__username", "lecturer__email")
    ordering = ("-created_at",)
    filter_horizontal = ("streams",)


@admin.register(ClassEnrollment)
class ClassEnrollmentAdmin(admin.ModelAdmin):
    """Admin view for student-class enrollment records."""

    list_display = ("student", "class_room", "enrolled_at")
    list_filter = ("class_room",)
    search_fields = ("student__username", "class_room__name")
    ordering = ("-enrolled_at",)


@admin.register(EnrollmentRequest)
class EnrollmentRequestAdmin(admin.ModelAdmin):
    """Admin view for enrollment request records."""

    list_display = ("student", "class_room", "status", "requested_at")
    list_filter = ("status",)
    search_fields = ("student__username", "class_room__name")
    ordering = ("-requested_at",)



