"""
Admin registration for the vms application.
"""

from django.contrib import admin

from .models import VMTemplate, VirtualMachine


@admin.register(VMTemplate)
class VMTemplateAdmin(admin.ModelAdmin):
    """Admin view for VM template catalogue entries."""

    list_display = ("name", "os", "cpu_cores", "ram_gb", "storage_gb", "is_available", "created_at")
    list_filter = ("is_available", "os")
    search_fields = ("name", "description", "os")
    ordering = ("name",)


@admin.register(VirtualMachine)
class VirtualMachineAdmin(admin.ModelAdmin):
    """Admin view for individual VM instances."""

    list_display = ("name", "owner", "template", "status", "cpu_usage", "ram_usage", "allocated_at")
    list_filter = ("status", "template")
    search_fields = ("name", "owner__username", "template__name")
    ordering = ("-allocated_at",)
    readonly_fields = ("allocated_at",)
