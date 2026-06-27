"""
Models for the classes application.

Defines the DIT academic hierarchy:
  Department → Programme → CourseStream

Plus class management:
  Class, ClassEnrollment, EnrollmentRequest

And practical session management:
  PracticalSession, StudentPracticalAccess
"""

from django.conf import settings
from django.db import models


class Department(models.Model):
    """
    A DIT academic department hosting various degree programmes.

    Attributes:
        code (str): Short unique code, e.g. "CS", "ETE".
        name (str): Full descriptive name, e.g. "Computer Studies".
        description (str): Optional description of the department.
        is_active (bool): Whether the department is currently active.
        created_at (datetime): When this department record was created.
    """

    code = models.CharField(
        max_length=10,
        unique=True,
        help_text="Short unique department code, e.g. 'CS'."
    )
    name = models.CharField(
        max_length=100,
        help_text="Full department name, e.g. 'Computer Studies'."
    )
    description = models.TextField(
        blank=True,
        help_text="Optional description of the department."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this department is currently active."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "departments"
        verbose_name = "Department"
        verbose_name_plural = "Departments"
        ordering = ["code"]

    def __str__(self):
        """Return department representation, e.g. 'CS — Computer Studies'."""
        return f"{self.code} — {self.name}"


class Programme(models.Model):
    """
    An academic programme offered by a DIT department.

    Sits between Department and CourseStream in the hierarchy:
        Department → Programme → CourseStream

    Examples:
        - Bachelor of Computer Engineering (NTA Level 8)
        - Ordinary Diploma in Information Technology (NTA Level 6)

    Attributes:
        department (Department): Parent department offering this programme.
        code (str): Short unique code, e.g. "BCOE", "ODIT".
        name (str): Full name, e.g. "Bachelor of Computer Engineering".
        nta_level (str): NTA Level, e.g. "NTA Level 8".
        duration_years (int): Expected programme duration in years.
        is_active (bool): Whether the programme is currently offered.
        created_at (datetime): When this programme record was created.
    """

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='programmes',
        help_text="Department offering this programme."
    )
    code = models.CharField(
        max_length=20,
        unique=True,
        help_text="Short unique programme code, e.g. 'BCOE', 'ODIT'."
    )
    name = models.CharField(
        max_length=150,
        help_text="Full programme name, e.g. 'Bachelor of Computer Engineering'."
    )
    level = models.CharField(
        max_length=20,
        choices=[
            ('diploma', 'Diploma (NTA 4-6)'),
            ('bachelor', 'Bachelor (NTA 7-8)'),
            ('master', 'Master (NTA 9)')
        ],
        default='bachelor',
        help_text="Programme level (e.g. bachelor, diploma)."
    )
    nta_range = models.CharField(
        max_length=20,
        blank=True,
        help_text="NTA range, e.g. 'NTA Level 4-6'."
    )
    duration_years = models.IntegerField(
        default=3,
        help_text="Expected programme duration in years (e.g. 3 for diploma, 4 for degree)."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this programme is currently offered."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "programmes"
        verbose_name = "Programme"
        verbose_name_plural = "Programmes"
        ordering = ["department", "code"]

    def __str__(self):
        """Return programme representation, e.g. 'BCOE — Bachelor of Computer Engineering'."""
        return f"{self.code} — {self.name}"


class CourseStream(models.Model):
    """
    A DIT programme stream/group, used to categorise students.

    Examples: "BENG22 COE-1", "BENG22 COE-2" (Computer Engineering groups).
    Used as a ForeignKey on the User model so dropdown selection replaces
    free-text stream entry.

    Hierarchy: Department → Programme → CourseStream

    Attributes:
        department (Department): The department this stream belongs to.
        programme (Programme): The programme this stream belongs to.
        code (str): Short unique code, e.g. "BENG22 COE-2".
        name (str): Full descriptive name, e.g. "Computer Engineering Group 2".
        year_of_study (int): Year of study (1, 2, 3, or 4).
        group_number (int): Group number.
        is_active (bool): Inactive streams are hidden from registration dropdowns.
        created_at (datetime): When the stream record was created.
    """

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='streams',
        null=True,
        blank=True,
        help_text="Department this stream belongs to."
    )
    programme = models.ForeignKey(
        'Programme',
        on_delete=models.CASCADE,
        related_name='streams',
        null=True,
        blank=True,
        help_text="Programme this stream belongs to."
    )
    code = models.CharField(
        max_length=30,
        unique=True,
        help_text="Short unique stream code, e.g. 'BENG22 COE-2'.",
    )
    name = models.CharField(
        max_length=150,
        help_text="Full descriptive name, e.g. 'Bachelor of Computer Engineering Year 2 Group 1'.",
    )
    year_of_study = models.IntegerField(
        default=1,
        help_text="Year of study (e.g. 1, 2, 3, or 4).",
    )
    group_number = models.IntegerField(
        default=1,
        help_text="Group number (COE-1, COE-2, etc.).",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive streams are hidden from registration dropdowns.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "course_streams"
        verbose_name = "Course Stream"
        verbose_name_plural = "Course Streams"
        ordering = ["department", "year_of_study", "code"]

    def __str__(self):
        """Return the course stream representation, e.g. 'BENG22 COE-2 — ...'."""
        return f"{self.code} — {self.name}"


class Class(models.Model):
    """
    A course or subject taught by a lecturer at DIT.

    Students are enrolled into classes via ClassEnrollment. Each class
    can have uploaded materials and assignments attached to it.

    A class belongs to a Department and Programme, and can be assigned
    to multiple CourseStreams via a ManyToManyField.

    Two class types exist:
    - 'official': Created by admin, linked to academic structure.
    - 'working_group': Created by lecturer for practical/lab sessions.

    Attributes:
        name (str): Human-readable course name (e.g. "Engineering Drawing 2").
        description (str): Optional longer description of the class.
        class_type (str): Either 'official' or 'working_group'.
        lecturer (User): The lecturer who owns and manages this class.
        created_by (User): The user who created this class record.
        department (Department): Department hosting this class.
        programme (Programme): Programme this class belongs to.
        streams (M2M CourseStream): Which streams take this class.
        academic_year (str): e.g. "2025/2026".
        semester (int): Semester 1 or 2.
        max_students (int): Maximum number of students allowed.
        created_at (datetime): When the class record was created.
        is_active (bool): Inactive classes are hidden from students.
    """

    CLASS_TYPE_OFFICIAL = 'official'
    CLASS_TYPE_WORKING_GROUP = 'working_group'
    CLASS_TYPE_CHOICES = [
        (CLASS_TYPE_OFFICIAL, 'Official Class'),
        (CLASS_TYPE_WORKING_GROUP, 'Working Group / Lab'),
    ]

    name = models.CharField(
        max_length=200,
        help_text="Full name of the course or class (e.g. Engineering Drawing 2).",
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Optional longer description of the class.",
    )
    class_type = models.CharField(
        max_length=20,
        choices=CLASS_TYPE_CHOICES,
        default=CLASS_TYPE_WORKING_GROUP,
        help_text="Type of class: official (admin-created) or working_group (lecturer-created).",
    )
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="classes_taught",
        limit_choices_to={"role": "lecturer"},
        help_text="The lecturer who owns this class.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_classes",
        help_text="The user who created this class record.",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="classes",
        help_text="Department hosting the class."
    )
    programme = models.ForeignKey(
        Programme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="classes",
        help_text="Programme this class belongs to."
    )
    streams = models.ManyToManyField(
        CourseStream,
        blank=True,
        related_name="classes_assigned",
        help_text="Course streams that take this class."
    )
    academic_year = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="e.g. 2025/2026"
    )
    semester = models.IntegerField(
        default=1,
        help_text="Semester 1 or 2"
    )
    max_students = models.IntegerField(
        default=60,
        help_text="Maximum number of students allowed"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive classes are hidden from student dashboards.",
    )

    class Meta:
        db_table = "classes"
        verbose_name = "Class"
        verbose_name_plural = "Classes"
        ordering = ["-created_at"]

    def __str__(self):
        """Return the class name as its string representation."""
        return self.name


class ClassEnrollment(models.Model):
    """
    Many-to-many join between a Student and a Class.

    Enforces uniqueness so a student cannot be enrolled in the same
    class twice. The related_name 'enrollments' on class_room lets
    views easily query all students in a class.

    Attributes:
        student (User): The enrolled student.
        class_room (Class): The class the student is enrolled in.
        enrolled_at (datetime): When the enrollment was created.
    """

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
        limit_choices_to={"role": "student"},
        help_text="The student who is enrolled.",
    )
    class_room = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name="enrollments",
        help_text="The class this student is enrolled in.",
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "class_enrollments"
        verbose_name = "Class Enrollment"
        verbose_name_plural = "Class Enrollments"
        unique_together = ["student", "class_room"]
        ordering = ["-enrolled_at"]

    def __str__(self):
        """Return a description of who is enrolled in which class."""
        return f"{self.student} → {self.class_room}"


class EnrollmentRequest(models.Model):
    """
    A request from a student to join a class.
    Lecturers can approve or reject these requests.
    """
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollment_requests",
        limit_choices_to={"role": "student"},
    )
    class_room = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name="enrollment_requests",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_requests"
    )
    message = models.TextField(blank=True, help_text="Optional message from the student.")
    rejection_reason = models.TextField(blank=True)

    class Meta:
        db_table = "enrollment_requests"
        unique_together = ["student", "class_room"]
        ordering = ["-requested_at"]

    def __str__(self):
        return f"{self.student} request for {self.class_room} ({self.status})"



