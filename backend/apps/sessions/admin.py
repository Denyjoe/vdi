"""
Admin registration for the sessions application.
"""

from django.contrib import admin

from .models import ActivityLog, ExamSession, RemoteSession


@admin.register(RemoteSession)
class RemoteSessionAdmin(admin.ModelAdmin):
    """Admin view for individual remote desktop sessions."""

    list_display = ("user", "vm", "status", "started_at", "ended_at", "duration_seconds", "ip_address")
    list_filter = ("status",)
    search_fields = ("user__username", "vm__name")
    ordering = ("-started_at",)
    readonly_fields = ("started_at",)


@admin.register(ExamSession)
class ExamSessionAdmin(admin.ModelAdmin):
    """Admin view for exam sessions."""

    list_display = ("name", "class_room", "lecturer", "status", "starts_at", "ends_at")
    list_filter = ("status",)
    search_fields = ("name", "class_room__name", "lecturer__username")
    ordering = ("-starts_at",)


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    """
    Admin view for the activity audit log.

    All fields are read-only — this is an immutable audit trail.
    """

    list_display = ("timestamp", "user", "action", "ip_address")
    list_filter = ("action",)
    search_fields = ("user__username", "action", "description")
    ordering = ("-timestamp",)
    readonly_fields = ("user", "action", "description", "metadata", "timestamp", "ip_address")

    def has_add_permission(self, request):
        """Prevent manual creation of log entries via admin."""
        return False

    def has_change_permission(self, request, obj=None):
        """Prevent editing of log entries via admin."""
        return False
