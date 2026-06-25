"""
Models for the classes application.

Defines Class (course/subject) and ClassEnrollment (the many-to-many
join between a student and a class). Lecturers own classes; students
enroll in them.
"""

from django.conf import settings
from django.db import models


class Class(models.Model):
    """
    A course or subject taught by a lecturer at DIT.

    Students are enrolled into classes via ClassEnrollment. Each class
    can have uploaded materials and assignments attached to it.

    Attributes:
        name (str): Human-readable course name (e.g. "Engineering Drawing 2").
        description (str): Optional longer description of the class.
        lecturer (User): The lecturer who owns and manages this class.
        created_at (datetime): When the class record was created.
        is_active (bool): Inactive classes are hidden from students.
    """

    name = models.CharField(
        max_length=200,
        help_text="Full name of the course or class (e.g. Engineering Drawing 2).",
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Optional longer description of the class.",
    )
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="classes_taught",
        limit_choices_to={"role": "lecturer"},
        help_text="The lecturer who owns this class.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive classes are hidden from student dashboards.",
    )

    department = models.CharField(max_length=100, blank=True, null=True, help_text="Department hosting the class.")
    academic_year = models.CharField(max_length=20, blank=True, null=True, help_text="e.g. 2025/2026")
    stream = models.CharField(max_length=50, blank=True, null=True, help_text="e.g. COE-2")
    semester = models.IntegerField(default=1, help_text="Semester 1 or 2")
    max_students = models.IntegerField(default=60, help_text="Maximum number of students allowed")

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
