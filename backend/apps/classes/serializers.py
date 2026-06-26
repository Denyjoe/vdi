"""
Serializers for the classes application.

Handles serialization/deserialization for Department, Programme,
CourseStream, Class, ClassEnrollment, EnrollmentRequest,
PracticalSession, and StudentPracticalAccess.
"""

from rest_framework import serializers
from .models import (
    Class, ClassEnrollment, EnrollmentRequest,
    Department, CourseStream, Programme,
)


# ── Custom RelatedField helpers ──────────────────────────────────────────────

class DepartmentRelatedField(serializers.RelatedField):
    """
    Custom field to read/write Department by code, name, or ID.

    Returns:
        str: Department code on read.
    """

    def get_queryset(self):
        """Return all departments as the lookup queryset."""
        return Department.objects.all()

    def to_representation(self, value):
        """Serialize to department code string."""
        return value.code

    def to_internal_value(self, data):
        """
        Deserialize from ID (int), code (str), or name (str).

        Args:
            data: The input value to look up.

        Returns:
            Department: The matched department instance.

        Raises:
            ValidationError: If no matching department is found.
        """
        if not data:
            return None
        # Try looking up by ID (integer)
        try:
            return Department.objects.get(id=int(data))
        except (ValueError, TypeError, Department.DoesNotExist):
            pass
        # Try looking up by code
        try:
            return Department.objects.get(code=data)
        except Department.DoesNotExist:
            pass
        # Try looking up by name
        try:
            return Department.objects.get(name=data)
        except Department.DoesNotExist:
            pass
        raise serializers.ValidationError(f"Department '{data}' not found.")


class ProgrammeRelatedField(serializers.RelatedField):
    """
    Custom field to read/write Programme by code, name, or ID.

    Returns:
        str: Programme code on read.
    """

    def get_queryset(self):
        """Return all programmes as the lookup queryset."""
        return Programme.objects.all()

    def to_representation(self, value):
        """Serialize to programme code string."""
        return value.code

    def to_internal_value(self, data):
        """
        Deserialize from ID (int), code (str), or name (str).

        Args:
            data: The input value to look up.

        Returns:
            Programme: The matched programme instance.

        Raises:
            ValidationError: If no matching programme is found.
        """
        if not data:
            return None
        # Try looking up by ID
        try:
            return Programme.objects.get(id=int(data))
        except (ValueError, TypeError, Programme.DoesNotExist):
            pass
        # Try looking up by code
        try:
            return Programme.objects.get(code=data)
        except Programme.DoesNotExist:
            pass
        # Try looking up by name
        try:
            return Programme.objects.get(name=data)
        except Programme.DoesNotExist:
            pass
        raise serializers.ValidationError(f"Programme '{data}' not found.")


class CourseStreamRelatedField(serializers.RelatedField):
    """
    Custom field to read/write CourseStream by code, name, or ID.

    Returns:
        str: CourseStream code on read.
    """

    def get_queryset(self):
        """Return all course streams as the lookup queryset."""
        return CourseStream.objects.all()

    def to_representation(self, value):
        """Serialize to stream code string."""
        return value.code

    def to_internal_value(self, data):
        """
        Deserialize from ID (int), code (str), or name (str).

        Args:
            data: The input value to look up.

        Returns:
            CourseStream: The matched course stream instance.

        Raises:
            ValidationError: If no matching course stream is found.
        """
        if not data:
            return None
        # Try looking up by ID
        try:
            return CourseStream.objects.get(id=int(data))
        except (ValueError, TypeError, CourseStream.DoesNotExist):
            pass
        # Try looking up by code
        try:
            return CourseStream.objects.get(code=data)
        except CourseStream.DoesNotExist:
            pass
        # Try looking up by name
        try:
            return CourseStream.objects.get(name=data)
        except CourseStream.DoesNotExist:
            pass
        raise serializers.ValidationError(f"CourseStream '{data}' not found.")


# ── Model Serializers ────────────────────────────────────────────────────────

class DepartmentSerializer(serializers.ModelSerializer):
    """
    Serializer for the Department model.

    Used in API responses for department listing and detail views.
    """

    class Meta:
        model = Department
        fields = ['id', 'code', 'name', 'description', 'is_active', 'created_at']


class ProgrammeSerializer(serializers.ModelSerializer):
    """
    Serializer for the Programme model.

    Includes nested department info for display purposes.
    """
    department_code = serializers.CharField(source='department.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = Programme
        fields = [
            'id', 'code', 'name', 'department', 'department_code',
            'department_name', 'level', 'nta_range', 'duration_years',
            'is_active', 'created_at',
        ]


class CourseStreamSerializer(serializers.ModelSerializer):
    """
    Serializer for the CourseStream model.

    Includes nested department and programme info.
    """
    department_code = serializers.CharField(source='department.code', read_only=True, default='')
    programme_code = serializers.CharField(source='programme.code', read_only=True, default='')
    programme_name = serializers.CharField(source='programme.name', read_only=True, default='')

    class Meta:
        model = CourseStream
        fields = [
            'id', 'code', 'name', 'department', 'department_code',
            'programme', 'programme_code', 'programme_name',
            'year_of_study', 'group_number', 'is_active', 'created_at',
        ]


class ClassEnrollmentSerializer(serializers.ModelSerializer):
    """
    Serializer for ClassEnrollment with nested student info.

    Returns student details inline so the frontend can display
    enrollment lists without additional API calls.
    """
    student = serializers.SerializerMethodField()
    class_room = serializers.CharField(source='class_room.name', read_only=True)

    class Meta:
        model = ClassEnrollment
        fields = ['id', 'student', 'class_room', 'enrolled_at']

    def get_student(self, obj):
        """
        Return a dict with student profile details.

        Args:
            obj: ClassEnrollment instance.

        Returns:
            dict: Student info including name, email, department, stream.
        """
        student = obj.student
        return {
            "name": f"{student.first_name} {student.last_name}".strip(),
            "email": student.email,
            "student_id": student.username,
            "department": student.department.name if student.department else '',
            "programme": student.programme.name if student.programme else '',
            "year": student.year_of_study if student.year_of_study else '',
            "stream": student.stream.code if student.stream else ''
        }


class ClassSerializer(serializers.ModelSerializer):
    """
    Serializer for Class with computed fields for enrollment counts
    and lecturer info.

    The streams field is a M2M, serialized as a list of stream codes
    on read and accepted as a list of stream IDs/codes on write.
    """
    lecturer = serializers.SerializerMethodField()
    enrolled_count = serializers.SerializerMethodField()
    pending_requests_count = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()
    department = DepartmentRelatedField(required=False, allow_null=True)
    programme = ProgrammeRelatedField(required=False, allow_null=True)
    streams = CourseStreamRelatedField(many=True, required=False)

    class Meta:
        model = Class
        fields = [
            'id', 'name', 'description', 'lecturer', 'department',
            'programme', 'streams', 'academic_year', 'semester',
            'max_students', 'is_active', 'created_at',
            'enrolled_count', 'pending_requests_count', 'is_enrolled',
        ]

    def get_lecturer(self, obj):
        """
        Return lecturer details as a nested dict.

        Args:
            obj: Class instance.

        Returns:
            dict: Lecturer id, name, and email.
        """
        return {
            "id": obj.lecturer.id,
            "name": f"{obj.lecturer.first_name} {obj.lecturer.last_name}".strip(),
            "email": obj.lecturer.email
        }

    def get_enrolled_count(self, obj):
        """
        Return the count of enrolled students.

        Args:
            obj: Class instance.

        Returns:
            int: Number of enrollments.
        """
        return obj.enrollments.count()

    def get_pending_requests_count(self, obj):
        """
        Return the count of pending enrollment requests.

        Args:
            obj: Class instance.

        Returns:
            int: Number of pending requests.
        """
        return obj.enrollment_requests.filter(status='pending').count()

    def get_is_enrolled(self, obj):
        """
        Return whether the current request user is enrolled in this class.

        Args:
            obj: Class instance.

        Returns:
            bool: True if the current student user is enrolled.
        """
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.role == 'student':
            return obj.enrollments.filter(student=request.user).exists()
        return False


class EnrollmentRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for EnrollmentRequest with nested student info
    and reviewer name.
    """
    student = serializers.SerializerMethodField()
    class_room_name = serializers.CharField(source='class_room.name', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EnrollmentRequest
        fields = [
            'id', 'student', 'class_room', 'class_room_name', 'status',
            'requested_at', 'reviewed_at', 'reviewed_by_name',
            'message', 'rejection_reason',
        ]

    def get_student(self, obj):
        """
        Return student details for the enrollment request.

        Args:
            obj: EnrollmentRequest instance.

        Returns:
            dict: Student info.
        """
        student = obj.student
        return {
            "id": student.id,
            "name": f"{student.first_name} {student.last_name}".strip(),
            "email": student.email,
            "student_id": student.username,
            "department": student.department.name if student.department else '',
            "programme": student.programme.name if student.programme else '',
            "year": student.year_of_study if student.year_of_study else '',
            "stream": student.stream.code if student.stream else ''
        }

    def get_reviewed_by_name(self, obj):
        """
        Return the full name of the reviewer, or None.

        Args:
            obj: EnrollmentRequest instance.

        Returns:
            str or None: Reviewer's full name.
        """
        if obj.reviewed_by:
            return f"{obj.reviewed_by.first_name} {obj.reviewed_by.last_name}".strip()
        return None



