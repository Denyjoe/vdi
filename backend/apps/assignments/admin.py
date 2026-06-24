"""
Admin registration for the assignments application.
"""

from django.contrib import admin

from .models import Assignment, File, Submission


@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    """Admin view for lecturer-uploaded class materials."""

    list_display = ("title", "class_room", "uploader", "file_size", "uploaded_at")
    list_filter = ("class_room",)
    search_fields = ("title", "uploader__username", "class_room__name")
    ordering = ("-uploaded_at",)
    readonly_fields = ("uploaded_at",)


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    """Admin view for assignments created by lecturers."""

    list_display = ("title", "class_room", "lecturer", "due_date", "is_active", "created_at")
    list_filter = ("is_active", "class_room")
    search_fields = ("title", "lecturer__username", "class_room__name")
    ordering = ("-created_at",)


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    """Admin view for student assignment submissions."""

    list_display = ("student", "assignment", "submitted_at", "is_late")
    list_filter = ("is_late", "assignment__class_room")
    search_fields = ("student__username", "assignment__title")
    ordering = ("-submitted_at",)
    readonly_fields = ("submitted_at",)
