"""
Models for the assignments application.

Defines three models:
  - File: Materials uploaded by lecturers and shared with a class.
  - Assignment: A task with a due date, created by a lecturer.
  - Submission: A file submitted by a student against an assignment.
"""

from django.conf import settings
from django.db import models


class File(models.Model):
    """
    A file uploaded by a lecturer and shared with their class.

    Students can download these from their class dashboard. Examples
    include lecture notes, reference manuals, lab instructions, etc.

    Attributes:
        class_room (Class): The class this file is shared with.
        uploader (User): The lecturer who uploaded the file.
        title (str): Display title for the file.
        file (FileField): The actual file stored in class_files/.
        description (str): Optional description of the file contents.
        uploaded_at (datetime): When the file was uploaded.
        file_size (int): File size in bytes, stored on upload.
    """

    class_room = models.ForeignKey(
        "classes.Class",
        on_delete=models.CASCADE,
        related_name="files",
        help_text="The class this file is shared with.",
    )
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="uploaded_files",
        help_text="The lecturer who uploaded this file.",
    )
    title = models.CharField(
        max_length=200,
        help_text="Display title for this file (e.g. 'Week 3 — Lecture Notes').",
    )
    file = models.FileField(
        upload_to="class_files/",
        help_text="The actual file. Stored in MEDIA_ROOT/class_files/.",
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Optional description of the file contents.",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_size = models.IntegerField(
        default=0,
        help_text="File size in bytes. Set automatically on upload.",
    )

    class Meta:
        db_table = "class_files"
        verbose_name = "Class File"
        verbose_name_plural = "Class Files"
        ordering = ["-uploaded_at"]

    def __str__(self):
        """Return the file title and its class."""
        return f"{self.title} ({self.class_room})"


class Assignment(models.Model):
    """
    A task created by a lecturer with a due date for their class.

    Students submit work against assignments. Lecturers can review
    submissions per assignment.

    Attributes:
        class_room (Class): The class this assignment belongs to.
        lecturer (User): The lecturer who created the assignment.
        title (str): Assignment title.
        description (str): Full assignment brief/instructions.
        due_date (datetime): Deadline for student submissions.
        created_at (datetime): When the assignment was created.
        is_active (bool): Inactive assignments do not accept submissions.
        max_file_size_mb (int): Maximum upload size for submissions in MB.
    """

    class_room = models.ForeignKey(
        "classes.Class",
        on_delete=models.CASCADE,
        related_name="assignments",
        help_text="The class this assignment belongs to.",
    )
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assignments_created",
        help_text="The lecturer who created this assignment.",
    )
    title = models.CharField(
        max_length=200,
        help_text="Title of the assignment.",
    )
    description = models.TextField(
        help_text="Full assignment brief and instructions for students.",
    )
    due_date = models.DateTimeField(
        help_text="Deadline by which students must submit.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive assignments are closed and do not accept new submissions.",
    )
    max_file_size_mb = models.IntegerField(
        default=10,
        help_text="Maximum allowed submission file size in megabytes.",
    )

    class Meta:
        db_table = "assignments"
        verbose_name = "Assignment"
        verbose_name_plural = "Assignments"
        ordering = ["-created_at"]

    def __str__(self):
        """Return the assignment title and its class."""
        return f"{self.title} ({self.class_room})"


class Submission(models.Model):
    """
    A file submitted by a student against a specific assignment.

    Enforces one submission per student per assignment via unique_together.
    The is_late flag is set by comparing submitted_at against the
    assignment's due_date.

    Attributes:
        assignment (Assignment): The assignment being submitted to.
        student (User): The student making the submission.
        file (FileField): The submitted file stored in submissions/.
        submitted_at (datetime): When the submission was made.
        is_late (bool): True if submitted after the assignment's due_date.
        notes (str): Optional notes from the student to the lecturer.
    """

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="submissions",
        help_text="The assignment this file is submitted against.",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submissions",
        help_text="The student who submitted this work.",
    )
    file = models.FileField(
        upload_to="submissions/",
        help_text="The submitted file. Stored in MEDIA_ROOT/submissions/.",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_late = models.BooleanField(
        default=False,
        help_text="True if the submission was made after the assignment due date.",
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Optional notes from the student to the lecturer.",
    )

    class Meta:
        db_table = "submissions"
        verbose_name = "Submission"
        verbose_name_plural = "Submissions"
        unique_together = ["assignment", "student"]
        ordering = ["-submitted_at"]

    def __str__(self):
        """Return a description of who submitted what."""
        late_tag = " (LATE)" if self.is_late else ""
        return f"{self.student} → {self.assignment}{late_tag}"
