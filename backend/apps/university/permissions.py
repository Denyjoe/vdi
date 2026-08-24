"""
Real, pure, testable authorization boundaries for the university layer.

Every check here is a plain function taking a real `user` and a real
target object/id — no request, no DRF, no side effects — so it can be
unit-tested directly and reused identically from DRF permission classes,
querysets, and management commands. This is the single source of truth
for "who can do what" in the university hierarchy; nothing elsewhere
should re-implement these checks.

Role precedence, made explicit here since nothing upstream defines it:
    admin > lecturer > student
A user can hold multiple UniversityAffiliation rows for the same
university (different departments/roles) — get_user_university_role
returns the single highest one.
"""
from rest_framework.permissions import BasePermission


def is_platform_superadmin(user):
    """True only for the real platform owner — reuses Django's own
    built-in is_superuser flag rather than inventing a new one."""
    return bool(user and user.is_authenticated and user.is_superuser)


class IsPlatformOrUniversityAdmin(BasePermission):
    """Real, broad gate for wizard resources that aren't tenant-scoped
    (the shared Proxmox ISO catalogue, desktop-environment profiles) or
    are already self-scoped by the view itself (a user's own jobs) —
    platform admins keep unrestricted access, and any REAL university
    admin (of at least one real, active University) also passes. Never
    used for anything that actually needs per-object university
    scoping — use can_access_template_job for that."""
    message = "Admin access required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'role', None) == 'admin':
            return True
        from .models import University
        return University.objects.filter(admin_user=user).exists()


class IsSuperAdmin(BasePermission):
    """DRF permission class — thin wrapper around is_platform_superadmin,
    so views and tests share the exact same single source of truth."""
    message = "Only the platform SuperAdmin can access this."

    def has_permission(self, request, view):
        return is_platform_superadmin(request.user)


def get_user_university_role(user, university_id):
    """Returns 'admin' / 'lecturer' / 'student' / None.

    'admin' is true if either:
      - the user IS this university's designated University.admin_user, or
      - the user holds an active UniversityAffiliation with role='admin'
        for this university.
    Otherwise the highest active affiliation role (lecturer > student).
    """
    if not user or not user.is_authenticated:
        return None

    from .models import University, UniversityAffiliation

    university_exists = University.objects.filter(id=university_id).exists()
    if not university_exists:
        return None

    if University.objects.filter(id=university_id, admin_user_id=user.id).exists():
        return 'admin'

    roles = set(
        UniversityAffiliation.objects.filter(
            user=user, university_id=university_id, is_active=True,
        ).values_list('role', flat=True)
    )
    if 'admin' in roles:
        return 'admin'
    if 'lecturer' in roles:
        return 'lecturer'
    if 'student' in roles:
        return 'student'
    return None


def can_manage_university(user, university):
    """True only if user is THIS university's admin_user.

    Deliberately strict and narrow — this gates billing/department/course
    creation for one specific university, not general 'has some role
    there' access. A platform SuperAdmin is NOT auto-granted this (they
    have their own, separate, explicit SuperAdmin-only surface instead —
    see Phase 3); this function is about per-university self-management.
    """
    if not user or not user.is_authenticated or university is None:
        return False
    return university.admin_user_id == user.id


def can_manage_department(user, department):
    """True if user manages the department's parent university."""
    if department is None:
        return False
    return can_manage_university(user, department.university)


def can_manage_course(user, course):
    """True if user is this course's lecturer OR the university admin."""
    if not user or not user.is_authenticated or course is None:
        return False

    from .models import CourseEnrollment

    if CourseEnrollment.objects.filter(
        course=course, user=user, role='lecturer',
    ).exists():
        return True

    return can_manage_university(user, course.department.university)


def resolve_context_university(request):
    """Phase 6 — the real, shared boundary behind account context
    switching. Returns (is_scoped, university_id):

      (False, None) - no ?context= param was sent at all. Callers that
        predate this feature (or any not-yet-updated caller) keep their
        exact original, unfiltered behavior - this preserves Phase 5's
        already-proven, already-live "My Sessions" default (a class
        session correctly shows up alongside regular ones with no
        context param) without regressing it.
      (True, None) - an explicit 'personal' context. Callers filter down
        to non-university-scoped rows only - this is what the real
        navbar switcher sends once "Personal Account" is genuinely
        selected, and is the actual boundary Phase 6's cross-
        contamination guarantee rests on.
      (True, <int>) - a real, validated university id: the caller
        filters to that university's data only.

    A university id the caller isn't actually affiliated with raises a
    real 403, exactly like every other crafted-request boundary in this
    app; an unparseable value raises a 400. Callers use this inside
    get_queryset()/get() - DRF turns a raised exception into the correct
    response automatically, before any cross-tenant row is ever touched.
    """
    from rest_framework.exceptions import PermissionDenied, ValidationError

    raw = request.query_params.get('context')
    if raw is None:
        return False, None
    if raw == 'personal':
        return True, None
    try:
        university_id = int(raw)
    except (TypeError, ValueError):
        raise ValidationError('Invalid context.')
    if get_user_university_role(request.user, university_id) is None:
        raise PermissionDenied('Not a member of this university.')
    return True, university_id


def can_access_template_job(user, job):
    """Phase 2 — real per-job access to the shared template wizard.
    Platform admins keep their existing, unrestricted access (unchanged
    behavior for every platform-wide job). A university admin ALSO gets
    real access, but ONLY for a job genuinely linked to their own
    university (job.university, set at creation from a real, approved
    TemplateRequest they control) — never a bare role check."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'role', None) == 'admin':
        return True
    if job.university_id:
        return can_manage_university(user, job.university)
    return False


def get_active_affiliations(user):
    """Real list of a user's active university contexts — the basis for
    the Phase 6 context switcher. Never crosses into another user's data."""
    if not user or not user.is_authenticated:
        return []

    from .models import UniversityAffiliation

    return list(
        UniversityAffiliation.objects.filter(
            user=user, is_active=True,
        ).select_related('university', 'department')
    )
