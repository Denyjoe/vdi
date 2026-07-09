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
    proxmox_template_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="Proxmox VM ID of the template to clone. Null = simulated.",
    )
    is_real = models.BooleanField(
        default=False,
        help_text="If True, launches real Proxmox VM. If False, simulated.",
    )
    template_type = models.CharField(
        max_length=20,
        choices=[
            ('desktop', 'Desktop'),
            ('server', 'Server'),
        ],
        default='desktop'
    )
    price_per_hour = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=0,
        help_text="Price per hour in TZS"
    )
    monthly_cap = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=0,
        help_text="Max monthly charge TZS"
    )
    target_pool_size = models.IntegerField(
        default=2,
        help_text="Number of VMs to keep pre-cloned and ready"
    )
    auto_refill_enabled = models.BooleanField(default=False)
    last_pool_refresh = models.DateTimeField(null=True, blank=True)
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
    ip_address = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="IP address of the running VM (populated by Proxmox guest agent).",
    )
    guacamole_connection_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Guacamole connection identifier for remote desktop access.",
    )

    class Meta:
        db_table = "virtual_machines"
        verbose_name = "Virtual Machine"
        verbose_name_plural = "Virtual Machines"
        ordering = ["-allocated_at"]

    def __str__(self):
        return f"{self.name} [{self.status}]"

class Workspace(models.Model):
  STATUS_CHOICES = [
    ('active', 'Active'),
    ('stopped', 'Stopped'),
    ('suspended', 'Suspended'),
    ('deleted', 'Deleted'),
  ]
  owner = models.ForeignKey(
    settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
    related_name='workspaces')
  name = models.CharField(max_length=100)
  vm_template = models.ForeignKey(
    VMTemplate, on_delete=models.PROTECT)
  vm = models.ForeignKey(
    VirtualMachine,
    on_delete=models.SET_NULL,
    null=True, blank=True)
  status = models.CharField(
    max_length=20,
    choices=STATUS_CHOICES,
    default='stopped')
  compute_hours_used = models.FloatField(
    default=0)
  last_accessed_at = models.DateTimeField(
    null=True, blank=True)
  created_at = models.DateTimeField(
    auto_now_add=True)

  class Meta:
    unique_together = ['owner', 'name']


class VMPoolEntry(models.Model):
    """
    A pre-cloned VM sitting ready in the pool for instant assignment.

    Admin pre-clones VMs that sit ready. When a user launches a workspace,
    they get assigned a ready VM instantly (~30s to start). When done, the
    VM is destroyed and the pool is refilled by admin.

    Attributes:
        template (VMTemplate): The template this VM was cloned from.
        proxmox_vmid (int): The Proxmox VM ID of this clone.
        ip_address (str): IP address assigned by DHCP/guest agent.
        guacamole_connection_id (str): Guacamole connection identifier.
        status (str): Pool lifecycle status.
        assigned_to (User): The user currently using this VM.
        assigned_vm (VirtualMachine): The linked VirtualMachine record.
        created_at (datetime): When this pool entry was created.
        assigned_at (datetime): When this VM was assigned to a user.
    """

    POOL_STATUS_CHOICES = [
        ('creating', 'Creating'),
        ('ready', 'Ready'),
        ('assigned', 'Assigned'),
        ('error', 'Error'),
    ]

    template = models.ForeignKey(
        VMTemplate,
        on_delete=models.CASCADE,
        related_name='pool_entries',
        help_text="The template this pool VM was cloned from.",
    )
    proxmox_vmid = models.IntegerField(
        unique=True,
        help_text="Proxmox VM ID of this clone.",
    )
    ip_address = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="IP address assigned to this VM.",
    )
    guacamole_connection_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Guacamole connection identifier for remote access.",
    )
    status = models.CharField(
        max_length=20,
        choices=POOL_STATUS_CHOICES,
        default='creating',
        help_text="Current pool lifecycle status.",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_pool_vms',
        help_text="The user currently using this VM.",
    )
    assigned_vm = models.ForeignKey(
        VirtualMachine,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='pool_entry',
        help_text="The linked VirtualMachine record when assigned.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    assigned_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this VM was assigned to a user.",
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'VM Pool Entry'
        verbose_name_plural = 'VM Pool Entries'

    def __str__(self):
        """Return a readable representation of this pool entry."""
        return f"Pool VM {self.proxmox_vmid} ({self.status})"
