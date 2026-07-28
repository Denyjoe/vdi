from rest_framework.permissions import BasePermission

class IsAdmin(BasePermission):
    message = "Only admins can access this."
    def has_permission(self, request, view):
        return (request.user.is_authenticated and request.user.role == 'admin')

class CanHostSessions(BasePermission):
    message = "Login required."
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

class IsSessionHost(BasePermission):
    message = "Only the session host."
    def has_object_permission(self, request, view, obj):
        return obj.host == request.user

class IsOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        return False
