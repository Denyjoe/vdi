"""
Models for the virtual machine (VMs) application.

Defines VMTemplate (the catalogue of available VM configurations) and
VirtualMachine (an instance allocated to a specific student). All
provisioning logic is routed through apps/vms/services/vm_orchestrator.py
— never directly from these models.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


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
    os_family = models.CharField(
        max_length=30,
        blank=True,
        default='',
        help_text=(
            "Simple OS family key used to pick a real, correctly-licensed "
            "icon (e.g. 'ubuntu', 'debian', 'parrot', 'zorin', 'windows') "
            "— distinct from the free-text 'os' display string."
        ),
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
            ('windows', 'Windows'),
        ],
        default='desktop'
    )
    price_per_hour = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=0,
        help_text="Price per hour in TZS"
    )
    price_per_month = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=0,
        help_text="Flat monthly subscription price in TZS for unlimited access to this template"
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
    university = models.ForeignKey(
        'university.University',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='templates',
        help_text=(
            "Optional. Null = platform-wide template, visible to everyone "
            "(existing behavior, unchanged). Set = scoped to this "
            "university only — used for course-specific templates."
        ),
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
        db_index=True,
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
    default='stopped',
    db_index=True)
  compute_hours_used = models.FloatField(
    default=0)
  last_accessed_at = models.DateTimeField(
    default=timezone.now,
    help_text="Last genuine launch (any launch path: free, paid, subscription, "
              "or power-up). The activity signal for idle-workspace detection.")
  created_at = models.DateTimeField(
    auto_now_add=True)
  access_reason = models.CharField(
    max_length=20, blank=True, default='',
    help_text="How the current/last launch was granted: 'subscription', 'free_hour', or 'paid'. "
              "Used at stop time to decide whether to log free-hour usage.")

  class Meta:
    unique_together = ['owner', 'name']


class TemplateSubscription(models.Model):
    """Monthly unlimited-access subscription, scoped to ONE template.

    Calendar-based: expires_at is set 30 days out at purchase/renewal time
    and is NEVER extended or paused by usage — heavy use during the month
    doesn't push the expiry back, light use doesn't refund unused days.
    Separate from session hosting, which remains pure pay-per-hour with no
    subscription requirement. One per (user, template) pair.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='template_subscriptions')
    template = models.ForeignKey(
        'VMTemplate', on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        unique_together = ['user', 'template']

    def is_valid(self):
        from django.utils import timezone
        return self.is_active and self.expires_at > timezone.now()


class WorkspaceHoursBalance(models.Model):
    """Purchased-hours balance, scoped to ONE (user, template) pair.

    Usage-metered: deducted at STOP time by real elapsed wall-clock time
    the VM was running (VirtualMachine.started_at -> stopped_at), by
    whichever path actually stopped it — user action, admin force-stop,
    or crash recovery all deduct identically.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='hours_balances')
    template = models.ForeignKey(
        'VMTemplate', on_delete=models.CASCADE)
    hours_remaining = models.DecimalField(
        max_digits=6, decimal_places=2, default=0)

    class Meta:
        unique_together = ['user', 'template']


class WorkspaceIdleNotification(models.Model):
    """Tracks which idle-lifecycle notifications a workspace has already
    received, so the daily idle-check never re-sends the same warning."""
    NOTIFICATION_TYPE_CHOICES = [
        ('first_warning', 'First Warning'),
        ('final_warning', 'Final Warning'),
        ('deleted', 'Deleted'),
    ]
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE,
        related_name='idle_notifications')
    notification_type = models.CharField(
        max_length=20, choices=NOTIFICATION_TYPE_CHOICES)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['workspace', 'notification_type']


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


class DesktopEnvironmentProfile(models.Model):
    """Reusable, data-driven definition of how to configure a specific
    desktop environment (XFCE, GNOME, ...) over RDP via xrdp.

    Adding a new environment is a new row here, not new code — every
    consumer (the template wizard's apply-configuration step) just reads
    session_command/fix_script/default_apps off whichever profile the
    admin picked.

    The two seeded rows are NOT reconstructed from memory or from stale
    scripts — they were extracted by live-inspecting the actual, current
    running Ubuntu Desktop (proxmox_template_id=9026) and Zorin Desktop
    (proxmox_template_id=9010) templates via real guest-agent exec calls
    (cat /etc/xrdp/startwm.sh, dpkg -l, etc.) against disposable clones,
    then deleting those clones. See the admin template-wizard build's
    commit message for the full real-evidence trail.
    """
    name = models.CharField(
        max_length=50, unique=True,
        help_text="Short machine key, e.g. 'xfce', 'gnome-zorin'.")
    display_name = models.CharField(max_length=100)
    session_command = models.TextField(
        help_text="The real, verified /etc/xrdp/startwm.sh content for this environment.")
    fix_script = models.TextField(
        blank=True,
        help_text="Real, proven setup commands to run before writing session_command "
                   "(package installs, cursor-fix file creation, permission fixes).")
    default_apps = models.JSONField(
        default=list, blank=True,
        help_text="Suggested default app package names for this environment, e.g. ['firefox'].")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_name']
        verbose_name = 'Desktop Environment Profile'
        verbose_name_plural = 'Desktop Environment Profiles'

    def __str__(self):
        return self.display_name


class TemplateCreationJob(models.Model):
    """Tracks one admin's multi-step run through the template-creation
    wizard, from VM creation through to a promoted, live VMTemplate.

    This spans multiple separate admin HTTP requests over real,
    unbounded time (OS install is a genuinely manual, human-paced step),
    so it needs to persist state between them rather than living in one
    atomic request/response.
    """
    STATUS_CHOICES = [
        ('vm_creating', 'Creating VM'),
        ('awaiting_os_install', 'Awaiting OS Install'),
        ('configuring', 'Applying Configuration'),
        ('installing_apps', 'Installing Applications'),
        ('finalizing', 'Finalizing Template'),
        ('verifying', 'Verifying Template'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    TEMPLATE_TYPE_CHOICES = [
        ('desktop', 'Desktop'),
        ('server', 'Server (CLI only)'),
        ('windows', 'Windows'),
    ]

    name = models.CharField(max_length=100)
    proxmox_vmid = models.IntegerField(null=True, blank=True)
    # Real, deliberate choice made here (Phase 3, CLI-only/headless
    # server templates): a 'server' job never gets a
    # DesktopEnvironmentProfile at all — there is no desktop to
    # configure, so forcing one onto every job (the old, non-nullable
    # PROTECT FK) would mean either lying about a fake desktop
    # environment for a real CLI-only build, or blocking the feature
    # entirely. null=True here is exactly what makes the server path
    # possible; every desktop-path call site must now handle
    # desktop_environment being None for a server job (see
    # template_wizard_views.py and _serialize_job).
    desktop_environment = models.ForeignKey(
        DesktopEnvironmentProfile, on_delete=models.PROTECT, null=True, blank=True)
    template_type = models.CharField(
        max_length=20, choices=TEMPLATE_TYPE_CHOICES, default='desktop',
        help_text=(
            "'desktop' = the existing flow (a chosen DesktopEnvironmentProfile "
            "is configured and streamed via RDP). 'server' = CLI-only/headless: "
            "no desktop environment at all, ongoing access is via Guacamole SSH "
            "only, never RDP/VNC. 'windows' = a genuine third path — no "
            "DesktopEnvironmentProfile/fix_script (desktop_environment stays "
            "null, same as 'server'), Windows' own native RDP server instead "
            "of xrdp, VirtIO drivers instead of a Linux guest agent, Sysprep "
            "instead of machine-id clearing at finalize time."
        ),
    )
    cpu_cores = models.IntegerField(default=2)
    ram_gb = models.IntegerField(default=4)
    disk_gb = models.IntegerField(default=20)
    iso_filename = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=30, choices=STATUS_CHOICES, default='vm_creating',
        db_index=True)
    error_message = models.TextField(blank=True)
    log = models.JSONField(
        default=list, blank=True,
        help_text="Real, timestamped step log for admin visibility.")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    final_template_id = models.IntegerField(
        null=True, blank=True,
        help_text="proxmox_vmid of the verified, finalized template, once known.")

    # Phase 2 (Product Depth Layer) — set only when this job was started
    # from a real, approved university TemplateRequest, via the SAME
    # create-job endpoint platform admins already use (not a parallel
    # build path). Null for every existing/platform-wide job, unchanged.
    university = models.ForeignKey(
        'university.University', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='template_jobs',
    )
    template_request = models.ForeignKey(
        'university.TemplateRequest', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='jobs',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Template Creation Job'
        verbose_name_plural = 'Template Creation Jobs'

    def __str__(self):
        return f"{self.name} ({self.status})"

    def log_step(self, message, level='info'):
        """Append a real, timestamped step to this job's log and save.

        Kept as a model method so every view that touches a job logs the
        exact same way — no risk of one endpoint forgetting the
        timestamp/level shape another relies on.
        """
        self.log.append({
            'ts': timezone.now().isoformat(),
            'level': level,
            'message': message,
        })
        self.save(update_fields=['log'])


class IsoDownloadTracking(models.Model):
    """Real, server-side-persistent tracking for a Proxmox
    download-url task. Deliberately NOT a field on TemplateCreationJob:
    a real ISO download commonly starts on the wizard's create-new-job
    form, before any job exists yet, so job-scoped tracking alone
    can't cover that case. Lets the wizard resume showing real,
    current progress after a navigation away and back, rather than
    starting the admin's awareness of an in-flight download over from
    zero."""
    upid = models.CharField(max_length=255, unique=True)
    filename = models.CharField(max_length=255)
    url = models.URLField(max_length=1000, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    finished = models.BooleanField(
        default=False,
        help_text="Set once the real Proxmox task is confirmed stopped, so it stops being offered as 'active'.")

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'ISO Download Tracking'
        verbose_name_plural = 'ISO Download Tracking'

    def __str__(self):
        return f"{self.filename} ({'finished' if self.finished else 'in progress'})"
