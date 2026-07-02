from rest_framework.permissions import (
  BasePermission)

class IsMember(BasePermission):
  message = "Only members can access this."
  def has_permission(self, request, view):
    return (request.user.is_authenticated
      and request.user.role == 'member')

class IsInstructor(BasePermission):
  message = "Only instructors can access this."
  def has_permission(self, request, view):
    return (request.user.is_authenticated
      and request.user.role == 'instructor')

class IsAdmin(BasePermission):
  message = "Only admins can access this."
  def has_permission(self, request, view):
    return (request.user.is_authenticated
      and request.user.role == 'admin')

class IsInstructorOrAdmin(BasePermission):
  message = "Only instructors or admins."
  def has_permission(self, request, view):
    return (request.user.is_authenticated
      and request.user.role in
      ['instructor', 'admin'])

class CanCreateSessions(BasePermission):
  message = "Upgrade to Pro to create sessions."
  def has_permission(self, request, view):
    if not request.user.is_authenticated:
      return False
    if request.user.role == 'admin':
      return True
    try:
      plan = request.user.subscription.plan
      return plan.can_create_sessions
    except:
      return False

class CanCreateGroups(BasePermission):
  message = "Upgrade to Starter to create groups."
  def has_permission(self, request, view):
    if not request.user.is_authenticated:
      return False
    if request.user.role in [
        'instructor', 'admin']:
      return True
    try:
      plan = request.user.subscription.plan
      return plan.can_create_groups
    except:
      return False

class IsOwnerOrAdmin(BasePermission):
  def has_object_permission(self,
      request, view, obj):
    if request.user.role == 'admin':
      return True
    if hasattr(obj, 'owner'):
      return obj.owner == request.user
    if hasattr(obj, 'created_by'):
      return obj.created_by == request.user
    if hasattr(obj, 'user'):
      return obj.user == request.user
    return False
