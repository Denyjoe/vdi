from rest_framework import permissions
from django.contrib.auth import get_user_model

User = get_user_model()

class IsStudent(permissions.BasePermission):
    message = "Only students can access this."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.STUDENT)


class IsLecturer(permissions.BasePermission):
    message = "Only lecturers can access this."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.LECTURER)


class IsAdmin(permissions.BasePermission):
    message = "Only admins can access this."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN)


class IsLecturerOrAdmin(permissions.BasePermission):
    message = "Only lecturers or admins can access this."

    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role in [User.Role.LECTURER, User.Role.ADMIN]
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    message = "You do not have permission to perform this action."

    def has_object_permission(self, request, view, obj):
        # Admin can access any object
        if request.user.role == User.Role.ADMIN:
            return True
        # Owner can access their own object
        return obj == request.user
