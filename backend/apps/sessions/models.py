"""
Models for the sessions application (app label: vdi_sessions).

Defines RemoteSession (tracks a student's browser-based VM session),
ExamSession (lecturer-controlled exam mode), and ActivityLog (audit trail
for all significant user actions).

NOTE: This app uses label = 'vdi_sessions' in apps.py to avoid a naming
collision with Django's built-in 'django.contrib.sessions' app.
"""

from django.conf import settings
from django.db import models


class RemoteSession(models.Model):
    """
    A single browser-based remote desktop session for one VM.

    Created when a student clicks "Connect" on a running VM. The session
    lifecycle is managed exclusively through
    apps/sessions/services/remote_session_manager.py.

    Attributes:
        vm (VirtualMachine): The VM being accessed in this session.
        user (User): The student who initiated the session.
        status (str): Current connection state (see Status choices).
        started_at (datetime): When the session was opened.
        ended_at (datetime): When the session was closed/terminated.
        duration_seconds (int): Total connected time in seconds.
        ip_address (str): The client IP address that connected.
    """

    class Status(models.TextChoices):
        """Connection states for a RemoteSession."""
        CONNECTING = "connecting", "Connecting"
        ACTIVE = "active", "Active"
        DISCONNECTED = "disconnected", "Disconnected"
        TERMINATED = "terminated", "Terminated"

    vm = models.ForeignKey(
        "vms.VirtualMachine",
        on_delete=models.CASCADE,
        related_name="sessions",
        help_text="The virtual machine this session connects to.",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="remote_sessions",
        help_text="The user who opened this session.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.CONNECTING,
        help_text="Current connection state of this session.",
    )
    started_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the session was initiated.",
    )
    ended_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the session ended. Null if still active.",
    )
    duration_seconds = models.IntegerField(
        default=0,
        help_text="Total connected time in seconds. Updated on session close.",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="The client IP address that initiated the connection.",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Arbitrary JSON context for the session (e.g. session token).",
    )

    class Meta:
        db_table = "remote_sessions"
        verbose_name = "Remote Session"
        verbose_name_plural = "Remote Sessions"
        ordering = ["-started_at"]

    def __str__(self):
        """Return a description of this session."""
        return f"{self.user} on {self.vm} [{self.status}]"


class ExamSession(models.Model):
    """
    A lecturer-controlled exam mode applied to an entire class.

    During an exam session, the lecturer can restrict what students can
    do inside their VM sessions (e.g. disable internet, disable copy-paste).

    Attributes:
        name (str): Descriptive name for the exam (e.g. "CAD Mid-Term Exam").
        class_room (Class): The class this exam session applies to.
        lecturer (User): The lecturer who created and controls this exam.
        status (str): Whether the exam is scheduled, active, or ended.
        starts_at (datetime): Scheduled start time.
        ends_at (datetime): Scheduled end time.
        restrict_internet (bool): Block internet access inside VMs.
        restrict_copy_paste (bool): Disable clipboard inside VMs.
        instructions (str): Additional instructions for the exam.
        allowed_vm_template (VMTemplate): If set, only VMs of this template can be used.
        grace_period_minutes (int): Allow students to connect slightly before the start time.
        created_at (datetime): When the exam session record was created.
    """

    class Status(models.TextChoices):
        """Lifecycle states for an ExamSession."""
        SCHEDULED = "scheduled", "Scheduled"
        ACTIVE = "active", "Active"
        ENDED = "ended", "Ended"

    name = models.CharField(
        max_length=200,
        help_text="Descriptive name for this exam (e.g. 'CAD Mid-Term Exam').",
    )
    group = models.ForeignKey(
        "classes.Group",
        on_delete=models.CASCADE,
        related_name="exam_sessions",
        help_text="The group this exam applies to.",
    )
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="exam_sessions_created",
        limit_choices_to={"role": "lecturer"},
        help_text="The lecturer who controls this exam.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
        help_text="Current state of this exam session.",
    )
    starts_at = models.DateTimeField(
        help_text="Scheduled start time for the exam.",
    )
    ends_at = models.DateTimeField(
        help_text="Scheduled end time for the exam.",
    )
    restrict_internet = models.BooleanField(
        default=True,
        help_text="Block internet access inside student VMs during this exam.",
    )
    restrict_copy_paste = models.BooleanField(
        default=True,
        help_text="Disable clipboard (copy-paste) inside student VMs during this exam.",
    )
    instructions = models.TextField(
        blank=True,
        default="",
        help_text="Specific instructions for students during this exam.",
    )
    allowed_vm_template = models.ForeignKey(
        "vms.VMTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="exam_sessions",
        help_text="Restrict students to using only VMs from this template.",
    )
    grace_period_minutes = models.IntegerField(
        default=0,
        help_text="Number of minutes before starts_at that students are allowed to connect.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "exam_sessions"
        verbose_name = "Exam Session"
        verbose_name_plural = "Exam Sessions"
        ordering = ["-starts_at"]

    def __str__(self):
        """Return the exam name and its current status."""
        return f"{self.name} [{self.status}]"


class ActivityLog(models.Model):
    """
    Immutable audit trail of significant user actions.

    Every important event (VM started, file uploaded, session terminated,
    login, etc.) is recorded here. Used by admin and lecturer monitoring
    dashboards. Records are never updated — only created.

    Attributes:
        user (User): The user who performed the action. Nullable so that
            system-level events can be logged without a user.
        action (str): Short action code (e.g. 'VM_STARTED', 'FILE_UPLOADED').
        description (str): Human-readable description of what happened.
        metadata (dict): Arbitrary JSON context for the event.
        timestamp (datetime): When the event occurred.
        ip_address (str): The client IP, if applicable.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
        help_text="The user who performed this action. Null for system-level events.",
    )
    action = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Short action code (e.g. 'VM_STARTED', 'LOGIN', 'FILE_UPLOADED').",
    )
    description = models.TextField(
        help_text="Human-readable description of what happened.",
    )
    metadata = models.JSONField(
        default=dict,
        help_text="Arbitrary JSON context for the event (e.g. VM ID, file name).",
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When this event occurred.",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="The client IP address associated with this event.",
    )

    class Meta:
        db_table = "activity_logs"
        verbose_name = "Activity Log"
        verbose_name_plural = "Activity Logs"
        ordering = ["-timestamp"]

    def __str__(self):
        """Return a short description of the logged event."""
        actor = str(self.user) if self.user else "System"
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {actor} — {self.action}"


class LiveSession(models.Model):
    SESSION_TYPE_CHOICES = [
        ('workshop', 'Workshop'),
        ('lab', 'Laboratory'),
        ('exam', 'Exam / Assessment'),
        ('lecture', 'Lecture'),
        ('study_group', 'Study Group'),
        ('training', 'Training'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('active', 'Active'),
        ('ended', 'Ended'),
        ('cancelled', 'Cancelled'),
    ]
    SUBMISSION_CHOICES = [
        ('none', 'No Submission'),
        ('file', 'File Upload'),
        ('snapshot', 'VM Snapshot'),
        ('both', 'File + Snapshot'),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='hosted_sessions')
    group = models.ForeignKey(
        'classes.Group',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='live_sessions')
    session_type = models.CharField(
        max_length=20,
        choices=SESSION_TYPE_CHOICES,
        default='workshop')
    required_vm_template = models.ForeignKey(
        'vms.VMTemplate',
        on_delete=models.SET_NULL,
        null=True, blank=True)
    invite_code = models.CharField(
        max_length=10, unique=True,
        blank=True)
    invite_link = models.CharField(
        max_length=200, blank=True)
    is_public = models.BooleanField(default=False)
    is_exam_mode = models.BooleanField(default=False)
    max_participants = models.IntegerField(
        default=50)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    submission_deadline = models.DateTimeField(
        null=True, blank=True)
    restrict_internet = models.BooleanField(
        default=False)
    restrict_copy_paste = models.BooleanField(
        default=False)
    allow_late_submission = models.BooleanField(
        default=True)
    submission_type = models.CharField(
        max_length=20,
        choices=SUBMISSION_CHOICES,
        default='none')
    instructions = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='scheduled')
    created_at = models.DateTimeField(
        auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.invite_code:
            self.invite_code = self._generate_code()
        if not self.invite_link:
            self.invite_link = f'/join/session/{self.invite_code}'
        super().save(*args, **kwargs)

    def _generate_code(self):
        import secrets, string
        chars = string.ascii_uppercase + string.digits
        while True:
            code = ''.join(secrets.choice(chars) for _ in range(8))
            if not LiveSession.objects.filter(invite_code=code).exists():
                return code

    def __str__(self):
        return self.name

class SessionParticipant(models.Model):
    STATUS_CHOICES = [
        ('joined', 'Joined'),
        ('active', 'Active'),
        ('disconnected', 'Disconnected'),
        ('submitted', 'Submitted'),
        ('removed', 'Removed'),
    ]
    session = models.ForeignKey(
        LiveSession, on_delete=models.CASCADE,
        related_name='participants')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='session_participations')
    vm = models.ForeignKey(
        'vms.VirtualMachine',
        on_delete=models.SET_NULL,
        null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='joined')
    joined_at = models.DateTimeField(
        auto_now_add=True)
    submitted_at = models.DateTimeField(
        null=True, blank=True)
    submission_file = models.FileField(
        upload_to='session_submissions/',
        null=True, blank=True)
    vm_snapshot_id = models.CharField(
        max_length=100, blank=True)

    class Meta:
        unique_together = ['session', 'user']

