"""
Serializers for the users application.

Handles user profile, registration, login, and password management.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from rest_framework.exceptions import ValidationError

User = get_user_model()

from apps.classes.models import Department, Programme


# ── Custom RelatedField helpers ──────────────────────────────────────────────

class DepartmentField(serializers.RelatedField):
    """
    Custom field to read/write Department on User profiles.
    Accepts ID, code, or name on write. Returns name on read.
    """

    def get_queryset(self):
        """Return all departments as the lookup queryset."""
        from apps.classes.models import Department
        return Department.objects.all()

    def to_representation(self, value):
        """Serialize to department name string."""
        return value.name if value else None

    def to_internal_value(self, data):
        """
        Deserialize from ID, code, or name.

        Args:
            data: The input value to look up.

        Returns:
            Department: The matched department instance.

        Raises:
            ValidationError: If no matching department is found.
        """
        if not data:
            return None
        from apps.classes.models import Department
        # Try ID
        try:
            return Department.objects.get(id=int(data))
        except (ValueError, TypeError, Department.DoesNotExist):
            pass
        # Try code
        try:
            return Department.objects.get(code=data)
        except Department.DoesNotExist:
            pass
        # Try name
        try:
            return Department.objects.get(name=data)
        except Department.DoesNotExist:
            pass
        raise serializers.ValidationError(f"Department '{data}' not found.")


class ProgrammeField(serializers.RelatedField):
    """
    Custom field to read/write Programme on User profiles.
    Accepts ID, code, or name on write. Returns nested object on read.
    """

    def get_queryset(self):
        """Return all programmes as the lookup queryset."""
        from apps.classes.models import Programme
        return Programme.objects.all()

    def to_representation(self, value):
        """Serialize to a nested dict with programme details."""
        if not value:
            return None
        return {
            'id': value.id,
            'code': value.code,
            'name': value.name,
            'department': value.department.name if value.department else '',
            'nta_range': value.nta_range,
            'level': value.level,
        }

    def to_internal_value(self, data):
        """
        Deserialize from ID, code, or name.

        Args:
            data: The input value to look up.

        Returns:
            Programme: The matched programme instance.

        Raises:
            ValidationError: If no matching programme is found.
        """
        if not data:
            return None
        from apps.classes.models import Programme
        # Try ID
        try:
            return Programme.objects.get(id=int(data))
        except (ValueError, TypeError, Programme.DoesNotExist):
            pass
        # Try code
        try:
            return Programme.objects.get(code=data)
        except Programme.DoesNotExist:
            pass
        # Try name
        try:
            return Programme.objects.get(name=data)
        except Programme.DoesNotExist:
            pass
        raise serializers.ValidationError(f"Programme '{data}' not found.")


class CourseStreamField(serializers.RelatedField):
    """
    Custom field to read/write CourseStream on User profiles.
    Accepts ID, code, or name on write. Returns nested object on read.
    """

    def get_queryset(self):
        """Return all course streams as the lookup queryset."""
        from apps.classes.models import CourseStream
        return CourseStream.objects.all()

    def to_representation(self, value):
        """Serialize to a nested dict with stream details."""
        if not value:
            return None
        return {
            'id': value.id,
            'code': value.code,
            'name': value.name,
            'department': value.department.name if value.department else '',
            'programme': value.programme.name if value.programme else '',
            'year_of_study': value.year_of_study,
        }

    def to_internal_value(self, data):
        """
        Deserialize from ID, code, or name.

        Args:
            data: The input value to look up.

        Returns:
            CourseStream: The matched course stream instance.

        Raises:
            ValidationError: If no matching course stream is found.
        """
        if not data:
            return None
        from apps.classes.models import CourseStream
        # Try ID
        try:
            return CourseStream.objects.get(id=int(data))
        except (ValueError, TypeError, CourseStream.DoesNotExist):
            pass
        # Try code
        try:
            return CourseStream.objects.get(code=data)
        except CourseStream.DoesNotExist:
            pass
        # Try name
        try:
            return CourseStream.objects.get(name=data)
        except CourseStream.DoesNotExist:
            pass
        raise serializers.ValidationError(f"CourseStream '{data}' not found.")


# ── Profile Serializer ──────────────────────────────────────────────────────

class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serialises a full user profile for the profile page.

    The stream and programme fields are returned as nested objects
    (id, code, name, etc.) instead of raw FK integers, so the
    frontend can display details without a second request.
    """
    stream = CourseStreamField(required=False, allow_null=True)
    department = DepartmentField(required=False, allow_null=True)
    programme = ProgrammeField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'role',
            'student_id', 'phone', 'avatar', 'is_approved', 'created_at',
            'department', 'programme', 'year_of_study', 'stream',
        ]
        read_only_fields = [
            'id', 'first_name', 'last_name', 'email', 'role',
            'student_id', 'is_approved', 'created_at',
        ]


# ── Update Profile Serializer ───────────────────────────────────────────────

class UpdateProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for updating a user's profile.
    """
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        allow_null=True,
        required=False
    )
    programme = serializers.PrimaryKeyRelatedField(
        queryset=Programme.objects.all(),
        allow_null=True,
        required=False
    )
    year_of_study = serializers.IntegerField(
        min_value=1,
        max_value=4,
        allow_null=True,
        required=False
    )
    avatar = serializers.ImageField(
        allow_null=True,
        required=False
    )

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'phone',
            'department', 'programme', 'year_of_study', 'avatar'
        ]

    def validate_avatar(self, value):
        if value:
            # Validate max size 2MB
            if value.size > 2 * 1024 * 1024:
                raise serializers.ValidationError("Avatar size cannot exceed 2MB.")
            # Validate extension
            import os
            ext = os.path.splitext(value.name)[1].lower()
            allowed_extensions = ['.jpg', '.jpeg', '.png', '.webp']
            if ext not in allowed_extensions:
                raise serializers.ValidationError(
                    f"Unsupported file extension {ext}. Allowed types are: jpg, jpeg, png, webp."
                )
        return value


# ── Registration Serializer ─────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for new user registration.

    Validates role-specific requirements:
    - Students must provide student_id, department, programme, year_of_study.
    - Lecturers must provide department.
    - Passwords must match.

    Note: Stream/group is NOT collected at registration.
    Admin assigns students to classes (and streams) later.
    """
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    department = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    programme = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    year_of_study = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'email', 'password',
            'confirm_password', 'role', 'student_id',
            'department', 'programme', 'year_of_study',
        ]

    def validate_role(self, value):
        """
        Validate that the role is one of the allowed values.

        Args:
            value: Role string to validate.

        Returns:
            str: Validated role value.

        Raises:
            ValidationError: If role is not student, lecturer, or admin.
        """
        valid_roles = [User.Role.STUDENT, User.Role.LECTURER, User.Role.ADMIN]
        if value not in valid_roles:
            raise serializers.ValidationError(f"Role must be one of: {', '.join(valid_roles)}")
        return value

    def validate(self, data):
        """
        Cross-field validation for registration data.

        Checks:
        - Passwords match.
        - Students must provide student_id, department, programme, year_of_study.
        - Lecturers must provide department.

        Args:
            data: Dict of validated field values.

        Returns:
            dict: Validated data.

        Raises:
            ValidationError: If any cross-field check fails.
        """
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({"password": "Passwords do not match."})

        role = data.get('role')

        if role == User.Role.STUDENT:
            if not data.get('student_id'):
                raise serializers.ValidationError({"student_id": "Student ID is required for students."})
            if not data.get('department'):
                raise serializers.ValidationError({"department": "Department is required for students."})
            if not data.get('programme'):
                raise serializers.ValidationError({"programme": "Programme is required for students."})
            if not data.get('year_of_study'):
                raise serializers.ValidationError({"year_of_study": "Year of study is required for students."})

        if role == User.Role.LECTURER:
            if not data.get('department'):
                raise serializers.ValidationError({"department": "Department is required for lecturers."})

        return data

    def create(self, validated_data):
        """
        Create a new user with the validated registration data.

        Resolves FK IDs for department and programme before
        creating the user instance. Stream is NOT set at registration.

        Args:
            validated_data: Dict of validated registration fields.

        Returns:
            User: The newly created user instance.
        """
        validated_data.pop('confirm_password')

        # Resolve FK references from IDs
        department_id = validated_data.pop('department', None)
        programme_id = validated_data.pop('programme', None)

        if department_id:
            from apps.classes.models import Department
            try:
                validated_data['department'] = Department.objects.get(id=department_id)
            except Department.DoesNotExist:
                raise serializers.ValidationError({"department": "Department not found."})

        if programme_id:
            from apps.classes.models import Programme
            try:
                validated_data['programme'] = Programme.objects.get(id=programme_id)
            except Programme.DoesNotExist:
                raise serializers.ValidationError({"programme": "Programme not found."})

        # Map email to username as required by AbstractUser
        validated_data['username'] = validated_data['email']
        user = User.objects.create_user(**validated_data)
        return user


# ── Activity Log Serializer ──────────────────────────────────────────────────

from apps.sessions.models import ActivityLog

class ActivityLogSerializer(serializers.ModelSerializer):
    """
    Serializer for ActivityLog entries displayed on admin dashboards.
    """
    user = serializers.CharField(source='user.email', read_only=True)
    description = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = ['id', 'user', 'action', 'description', 'timestamp', 'metadata', 'ip_address']

    def get_description(self, obj):
        """
        Return a human-readable description for common action codes.

        Args:
            obj: ActivityLog instance.

        Returns:
            str: Human-readable description.
        """
        action_map = {
            'LOGIN_SUCCESS': 'User logged in successfully',
            'LOGIN_FAILED': 'Failed login attempt',
            'LOGOUT': 'User logged out',
            'USER_DEACTIVATED': 'User account deactivated',
            'USER_ACTIVATED': 'User account activated',
        }
        return action_map.get(obj.action, obj.action)


# ── Login Serializer ────────────────────────────────────────────────────────

class LoginSerializer(serializers.Serializer):
    """
    Serializer for user login. Validates email + password credentials.
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        """
        Authenticate the user with email and password.

        Args:
            data: Dict with 'email' and 'password'.

        Returns:
            dict: Validated data with 'user' key added.

        Raises:
            ValidationError: If credentials are invalid.
        """
        email = data.get('email')
        password = data.get('password')

        if email and password:
            user = authenticate(request=self.context.get('request'), username=email, password=password)
            if not user:
                raise serializers.ValidationError("Invalid email or password.", code='authorization')
        else:
            raise serializers.ValidationError("Must include 'email' and 'password'.", code='authorization')

        data['user'] = user
        return data


# ── Password Change Serializer ──────────────────────────────────────────────

class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer for changing a user's password.
    Validates old password and confirms new passwords match.
    """
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_new_password = serializers.CharField(required=True, min_length=8)

    def validate_old_password(self, value):
        """
        Verify the old password is correct.

        Args:
            value: The old password string.

        Returns:
            str: Validated old password.

        Raises:
            ValidationError: If old password is incorrect.
        """
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is not correct")
        return value

    def validate(self, data):
        """
        Check that new passwords match.

        Args:
            data: Dict with password fields.

        Returns:
            dict: Validated data.

        Raises:
            ValidationError: If new passwords don't match.
        """
        if data['new_password'] != data['confirm_new_password']:
            raise serializers.ValidationError({"new_password": "New passwords do not match"})
        return data
