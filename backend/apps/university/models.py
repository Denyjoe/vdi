"""
University layer — real institutional accounts layered on top of the
existing Ospace platform.

Nothing here replaces or duplicates an existing system. A university is
an OPTIONAL affiliation a normal User account can hold (via
UniversityAffiliation / CourseEnrollment) — there is no separate login,
no parallel Workspace/LiveSession table, no parallel template catalogue.
Scoping into the existing systems is done via nullable FKs added to
VMTemplate (university) and LiveSession (course) in their own apps.

Hierarchy:
    University -> Department -> Course
    User <-(UniversityAffiliation)-> University/Department  (role: student/lecturer/admin)
    User <-(CourseEnrollment)-> Course  (role: student/lecturer, scoped to one course)
    University -> UniversityInvoice  (real, manually-tracked billing)
"""
from django.conf import settings
from django.db import models


class University(models.Model):
    """A real institutional customer. Starts 'pending' from the public
    request form; only the platform SuperAdmin can approve it to 'active'.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('rejected', 'Rejected'),
    ]
    BILLING_CYCLE_CHOICES = [
        ('monthly', 'Monthly'),
        ('semester', 'Per Semester'),
        ('annual', 'Annual'),
    ]

    name = models.CharField(max_length=200)
    logo = models.ImageField(upload_to='university_logos/', null=True, blank=True)
    contact_email = models.EmailField()
    contact_name = models.CharField(max_length=200)
    description = models.TextField(
        blank=True, default='',
        help_text="Brief description submitted with the access request.",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rejection_reason = models.TextField(blank=True, default='')

    admin_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='administered_universities',
        help_text="The real user account that administers this university.",
    )
    seats_allocated = models.IntegerField(default=0)
    price_per_seat_tzs = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    billing_cycle = models.CharField(max_length=20, choices=BILLING_CYCLE_CHOICES, default='semester')

    # What the requester asked for on the public form — informational only,
    # never enforced directly. The SuperAdmin sets the REAL, approved
    # max_* ceiling during approval (Phase 1), which may genuinely differ
    # from what was requested — this is a real negotiation, not a fixed
    # self-serve number.
    requested_vcpu_cores = models.IntegerField(null=True, blank=True)
    requested_ram_gb = models.IntegerField(null=True, blank=True)
    requested_storage_gb = models.IntegerField(null=True, blank=True)

    # The real, approved hardware ceiling — 0 until a SuperAdmin sets it
    # at approval. Enforced by apps.university.services.quota_service
    # against real template specs + real running VM specs.
    max_vcpu_cores = models.IntegerField(default=0)
    max_ram_gb = models.IntegerField(default=0)
    max_storage_gb = models.IntegerField(default=0)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_universities',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.status})"


class Department(models.Model):
    university = models.ForeignKey(University, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, help_text="e.g. 'CS', 'BA'")
    logo = models.ImageField(upload_to='department_logos/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('university', 'code')]
        ordering = ['name']

    def __str__(self):
        return f"{self.university.name} / {self.code}"


class Course(models.Model):
    DAY_CHOICES = [
        ('monday', 'Monday'), ('tuesday', 'Tuesday'), ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'), ('friday', 'Friday'), ('saturday', 'Saturday'), ('sunday', 'Sunday'),
    ]

    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='courses')
    name = models.CharField(max_length=200, help_text="'Intro to Programming'")
    code = models.CharField(max_length=20, help_text="'CS101'")
    default_template = models.ForeignKey(
        'vms.VMTemplate', on_delete=models.SET_NULL, null=True, blank=True,
    )
    default_restrictions = models.JSONField(
        default=dict, blank=True,
        help_text="clipboard/file-transfer/network-lockdown defaults for this course's sessions.",
    )
    # Phase 4 (Product Depth Layer) — recurring class schedule. Both null
    # means "no recurring schedule set" (existing courses, unchanged);
    # real "Start Class Session" launches are unaffected either way —
    # this is purely informational, shown to students/lecturers.
    schedule_day = models.CharField(max_length=10, choices=DAY_CHOICES, null=True, blank=True)
    schedule_time = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('department', 'code')]
        ordering = ['code']

    def __str__(self):
        return f"{self.code} — {self.name}"


class UniversityAffiliation(models.Model):
    """The real link enabling 'same account, multiple contexts' — a User
    keeps exactly one login, but may hold any number of these.
    """

    ROLE_CHOICES = [
        ('student', 'Student'),
        ('lecturer', 'Lecturer'),
        ('admin', 'University Admin'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='university_affiliations',
    )
    university = models.ForeignKey(University, on_delete=models.CASCADE, related_name='affiliations')
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, null=True, blank=True, related_name='affiliations',
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='granted_affiliations',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('user', 'university', 'department', 'role')]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} @ {self.university.name} ({self.role})"


class CourseEnrollment(models.Model):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('lecturer', 'Lecturer'),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='course_enrollments')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('course', 'user')]
        ordering = ['-enrolled_at']

    def __str__(self):
        return f"{self.user} in {self.course.code} ({self.role})"


class DepartmentInvite(models.Model):
    """A real, unique, shareable self-enroll link for one department.
    Anyone who opens it while logged in gets a 'student' UniversityAffiliation
    (and, if a course is set, a CourseEnrollment) for that department.
    """

    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='invites')
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True)
    code = models.CharField(max_length=24, unique=True)
    role = models.CharField(
        max_length=20, choices=UniversityAffiliation.ROLE_CHOICES, default='student',
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invite({self.code}) -> {self.department}"


class UniversityInvoice(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
    ]

    university = models.ForeignKey(University, on_delete=models.CASCADE, related_name='invoices')
    amount_tzs = models.DecimalField(max_digits=12, decimal_places=2)
    billing_period_start = models.DateField()
    billing_period_end = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    due_date = models.DateField()
    marked_paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invoice #{self.id} — {self.university.name} ({self.status})"


class TemplateRequest(models.Model):
    """Phase 2 — a real lecturer's request for a new VM template for
    their course, reviewed by their university admin and built through
    the SAME real template wizard used for platform-wide templates
    (see apps.vms.template_wizard_views) — not a parallel build system.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved — Building'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='template_requests')
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    software_needed = models.TextField()
    purpose = models.TextField()
    estimated_vcpu = models.IntegerField()
    estimated_ram_gb = models.IntegerField()
    estimated_storage_gb = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(blank=True, default='')
    resulting_template = models.ForeignKey(
        'vms.VMTemplate', on_delete=models.SET_NULL, null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.course.code} template request ({self.status})"
