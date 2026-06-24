"""
Models for the virtual machine (VMs) application.

Defines VMTemplate (the catalogue of available VM configurations) and
VirtualMachine (an instance allocated to a specific student). All
provisioning logic is routed through apps/vms/services/vm_orchestrator.py
— never directly from these models.
"""

from django.conf import settings
from django.db import models


class VMTemplate(models.Model):
    """
    A reusable blueprint describing a type of virtual machine.

    Examples: "AutoCAD Workstation", "MATLAB Lab", "Programming Environment".
    Students browse this catalogue and request an instance from it.

    Attributes:
        name (str): Display name shown in the student catalogue.
        description (str): Explains what this template is used for.
        cpu_cores (int): Number of virtual CPU cores.
        ram_gb (int): RAM allocated in gigabytes.
        storage_gb (int): Disk size in gigabytes.
        software_list (list[str]): JSON list of pre-installed software names.
        os (str): Operating system (e.g. "Windows 10", "Ubuntu 22.04").
        is_available (bool): If False, students cannot request this template.
        icon (str): Emoji or icon identifier shown on the catalogue card.
        created_at (datetime): When this template was added to the catalogue.
    """

    name = models.CharField(
        max_length=150,
        help_text="Display name shown in the VM catalogue (e.g. AutoCAD Workstation).",
    )
    description = models.TextField(
        help_text="Explains what this template is for and who should request it.",
    )
    cpu_cores = models.IntegerField(
        help_text="Number of virtual CPU cores allocated to this VM type.",
    )
    ram_gb = models.IntegerField(
        help_text="RAM in gigabytes allocated to this VM type.",
    )
    storage_gb = models.IntegerField(
        help_text="Disk size in gigabytes allocated to this VM type.",
    )
    software_list = models.JSONField(
        default=list,
        help_text="JSON array of pre-installed software names (e.g. ['AutoCAD 2024', 'Revit']).",
    )
    os = models.CharField(
        max_length=100,
        help_text="Operating system (e.g. 'Windows 10', 'Ubuntu 22.04').",
    )
    is_available = models.BooleanField(
        default=True,
        help_text="If False, this template is hidden from the student catalogue.",
    )
    icon = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Emoji or icon identifier for the catalogue card (e.g. '🖥️').",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vm_templates"
        verbose_name = "VM Template"
        verbose_name_plural = "VM Templates"
        ordering = ["name"]

    def __str__(self):
        """Return the template name and its OS."""
        return f"{self.name} ({self.os})"


class VirtualMachine(models.Model):
    """
    A virtual machine instance allocated to a specific student.

    Created when a student requests a VM from the catalogue. Its lifecycle
    (provisioning → running → stopped → deleted) is managed exclusively
    through apps/vms/services/vm_orchestrator.py.

    Attributes:
        template (VMTemplate): The blueprint this VM was created from.
        owner (User): The student who owns this VM.
        name (str): Auto-generated friendly name.
        status (str): Current lifecycle status (see Status choices).
        proxmox_vm_id (int): The real Proxmox VM ID (null when simulated).
        cpu_usage (float): Simulated CPU utilisation percentage (0–100).
        ram_usage (float): Simulated RAM utilisation percentage (0–100).
        allocated_at (datetime): When the VM was first requested.
        started_at (datetime): When the VM last transitioned to RUNNING.
        stopped_at (datetime): When the VM last transitioned to STOPPED.
        notes (str): Optional internal notes or error messages.
    """

    class Status(models.TextChoices):
        """Lifecycle states a VirtualMachine can be in."""
        PROVISIONING = "provisioning", "Provisioning"
        RUNNING = "running", "Running"
        STOPPED = "stopped", "Stopped"
        ERROR = "error", "Error"
        DELETED = "deleted", "Deleted"

    template = models.ForeignKey(
        VMTemplate,
        on_delete=models.PROTECT,
        related_name="instances",
        help_text="The template this VM was built from.",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="virtual_machines",
        help_text="The student who owns this VM.",
    )
    name = models.CharField(
        max_length=150,
        help_text="Auto-generated friendly name for this VM (e.g. 'AutoCAD-Denis-001').",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROVISIONING,
        help_text="Current lifecycle status of this virtual machine.",
    )
    proxmox_vm_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="The real Proxmox VM ID. Null when running in simulation mode.",
    )
    cpu_usage = models.FloatField(
        default=0.0,
        help_text="Current CPU utilisation percentage (0–100). Updated by vm_orchestrator.",
    )
    ram_usage = models.FloatField(
        default=0.0,
        help_text="Current RAM utilisation percentage (0–100). Updated by vm_orchestrator.",
    )
    allocated_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the student first requested this VM.",
    )
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the VM last transitioned to RUNNING status.",
    )
    stopped_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the VM last transitioned to STOPPED status.",
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Optional internal notes or error messages from the orchestrator.",
    )

    class Meta:
        db_table = "virtual_machines"
        verbose_name = "Virtual Machine"
        verbose_name_plural = "Virtual Machines"
        ordering = ["-allocated_at"]

    def __str__(self):
        """Return the VM name and its current status."""
        return f"{self.name} [{self.status}]"
