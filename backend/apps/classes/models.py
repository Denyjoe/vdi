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
