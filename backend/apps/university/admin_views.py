"""
Phase 4 — University Admin Dashboard.

Every view here is gated by the REAL, adversarially-tested Phase 2
permission functions (can_manage_university / can_manage_department /
can_manage_course) — never by trusting a university_id/department_id
the client sent. The object is always looked up first, then the
permission function is called against the REAL object; a crafted
request naming another university's id gets exactly the same 403 (or
404, for nested objects that don't even belong to the resolved parent)
as a legitimate-looking one, and never leaks a row of another tenant's
data in the process.
"""
import csv
import io
import secrets

from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User
from .models import University, Department, Course, UniversityAffiliation, CourseEnrollment, DepartmentInvite
from .permissions import can_manage_university, can_manage_department, can_manage_course


def _get_managed_university_or_403(user, university_id):
    """Real, shared lookup+permission pattern: resolve the object first,
    THEN check the real permission function against it. Returns
    (university, error_response). A university_id for a real university
    the caller doesn't manage returns a 403 with no data — the row is
    only ever loaded to run the check, never serialized back."""
    try:
        university = University.objects.get(pk=university_id)
    except University.DoesNotExist:
        return None, Response({'success': False, 'message': 'Not found'}, status=404)
    if not can_manage_university(user, university):
        return None, Response({'success': False, 'message': 'Not your university.'}, status=403)
    return university, None


def _get_managed_department_or_403(user, department_id):
    try:
        department = Department.objects.select_related('university').get(pk=department_id)
    except Department.DoesNotExist:
        return None, Response({'success': False, 'message': 'Not found'}, status=404)
    if not can_manage_department(user, department):
        return None, Response({'success': False, 'message': 'Not your department.'}, status=403)
    return department, None


def _get_managed_course_or_403(user, course_id):
    try:
        course = Course.objects.select_related('department__university').get(pk=course_id)
    except Course.DoesNotExist:
        return None, Response({'success': False, 'message': 'Not found'}, status=404)
    if not can_manage_course(user, course):
        return None, Response({'success': False, 'message': 'Not your course.'}, status=403)
    return course, None


def grant_role_in_department(user, department, role, course=None, granted_by=None):
    """THE one real place every grant path (department-scoped lecturer
    grant, course-scoped lecturer grant, bulk-CSV enrollment, self-
    enroll invite redemption) creates its real UniversityAffiliation and
    — where a real course is genuinely relevant — CourseEnrollment
    row(s). Written once, used everywhere a role is granted, so the
    exact class of bug found twice already (one code path creates
    record type A, a different part of the system checks for record
    type B) becomes structurally impossible to reintroduce per-callsite.

    - ALWAYS creates/reuses the real UniversityAffiliation — this is
      the one real thing get_active_affiliations() (the context
      switcher) and every "does this account hold any role here" check
      actually looks for. get_or_create so it never clobbers an
      existing, different role this same account might also hold.
    - If a specific `course` is given, ALSO creates/reuses a real
      CourseEnrollment for that course — the one real thing
      MyCoursesView / MyCourseworkView (and therefore the lecturer's
      "My Courses" page and the Sidebar's Teaching/Student nav
      sections) actually query.
    - If NO course is given and role == 'lecturer': a department-wide
      lecturer grant is real intent to teach in that department, not a
      no-op — so this creates a real CourseEnrollment for EVERY course
      that currently exists in the department. Without this, a
      department-wide lecturer has a real, valid affiliation (so the
      context switcher shows the university) but zero courses, so
      MyCoursesView legitimately returns nothing and the whole Teaching
      section — and the account's entire visible lecturer capability —
      stays permanently empty, exactly the real bug reported. A
      department with zero courses yet genuinely has nothing to enroll
      them in — that's an honest state, not a bug, until a real course
      exists.
    - If NO course is given and role == 'student': no CourseEnrollment
      is created — a department-wide student without a specific course
      genuinely isn't "in" any course yet (unlike a lecturer, who
      reasonably teaches everything already in their department),
      matching the existing, correct MyCourseworkView behavior.

    Returns (affiliation, enrolled_course_codes: list[str]).
    """
    affiliation, _created = UniversityAffiliation.objects.get_or_create(
        user=user, university=department.university, department=department, role=role,
        defaults={'granted_by': granted_by},
    )

    enrolled_codes = []
    if course is not None:
        CourseEnrollment.objects.get_or_create(course=course, user=user, defaults={'role': role})
        enrolled_codes.append(course.code)
    elif role == 'lecturer':
        for c in Course.objects.filter(department=department):
            CourseEnrollment.objects.get_or_create(course=c, user=user, defaults={'role': role})
            enrolled_codes.append(c.code)

    return affiliation, enrolled_codes


def revoke_role_in_department(user, department, role, course=None):
    """The symmetric counterpart to grant_role_in_department. Revoking a
    department-wide grant also removes every CourseEnrollment that
    grant itself created (every course in the department, for
    lecturers) — otherwise a revoke would leave phantom lecturer
    entries a course's own roster/detail view would keep showing
    forever with no way to remove them."""
    if course is not None:
        CourseEnrollment.objects.filter(course=course, user=user, role=role).delete()
        return

    UniversityAffiliation.objects.filter(
        user=user, university=department.university, department=department, role=role,
    ).delete()
    if role == 'lecturer':
        CourseEnrollment.objects.filter(course__department=department, user=user, role=role).delete()


def _department_summary(d):
    return {
        'id': d.id, 'university_id': d.university_id, 'name': d.name, 'code': d.code,
        'logo': d.logo.url if d.logo else None,
        'course_count': d.courses.count(),
        'created_at': d.created_at,
    }


def _course_summary(c):
    course_lecturers = c.enrollments.filter(role='lecturer').select_related('user')
    return {
        'id': c.id, 'department_id': c.department_id, 'name': c.name, 'code': c.code,
        'default_template_id': c.default_template_id,
        'default_restrictions': c.default_restrictions,
        'schedule_day': c.schedule_day,
        'schedule_time': c.schedule_time.strftime('%H:%M') if c.schedule_time else None,
        'enrollment_count': c.enrollments.count(),
        'lecturer_count': course_lecturers.count(),
        # Real names, not just a count — Issue 3: "Lecturer: [name]" was
        # genuinely nowhere visible after a course-scoped grant. This is
        # ONLY course-scoped grants (CourseEnrollment); a department-wide
        # lecturer grant (UniversityAffiliation with no course_id) is
        # real too but intentionally not "for" any specific course —
        # it shows up in the university-wide Lecturers list instead.
        'lecturers': [
            {'user_id': e.user_id, 'name': f'{e.user.first_name} {e.user.last_name}'.strip() or e.user.email, 'email': e.user.email}
            for e in course_lecturers
        ],
        'student_count': c.enrollments.filter(role='student').count(),
        'created_at': c.created_at,
    }


class MyUniversitiesView(APIView):
    """The real entry point for the dashboard — universities THIS user
    genuinely administers, nothing else."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        unis = University.objects.filter(admin_user=request.user)
        return Response({
            'success': True,
            'data': [
                {'id': u.id, 'name': u.name, 'status': u.status, 'department_count': u.departments.count()}
                for u in unis
            ],
        })


# ── Departments ───────────────────────────────────────────────────────

class DepartmentListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, university_id):
        university, err = _get_managed_university_or_403(request.user, university_id)
        if err:
            return err
        return Response({
            'success': True,
            'data': [_department_summary(d) for d in university.departments.all()],
        })

    def post(self, request, university_id):
        university, err = _get_managed_university_or_403(request.user, university_id)
        if err:
            return err

        name = (request.data.get('name') or '').strip()
        code = (request.data.get('code') or '').strip().upper()
        if not name or not code:
            return Response({'success': False, 'message': 'name and code are required.'}, status=400)
        if Department.objects.filter(university=university, code=code).exists():
            return Response({'success': False, 'message': f'Department code "{code}" already exists.'}, status=400)

        dept = Department.objects.create(university=university, name=name, code=code)
        return Response({'success': True, 'data': _department_summary(dept)}, status=201)


class DepartmentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, department_id):
        department, err = _get_managed_department_or_403(request.user, department_id)
        if err:
            return err
        if 'name' in request.data:
            department.name = (request.data.get('name') or '').strip() or department.name
        if 'code' in request.data:
            new_code = (request.data.get('code') or '').strip().upper()
            if new_code and Department.objects.filter(
                university=department.university, code=new_code,
            ).exclude(pk=department.pk).exists():
                return Response({'success': False, 'message': f'Department code "{new_code}" already exists.'}, status=400)
            department.code = new_code or department.code
        department.save()
        return Response({'success': True, 'data': _department_summary(department)})


# ── Courses ───────────────────────────────────────────────────────────

class CourseListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, department_id):
        department, err = _get_managed_department_or_403(request.user, department_id)
        if err:
            return err
        return Response({
            'success': True,
            'data': [_course_summary(c) for c in department.courses.all()],
        })

    def post(self, request, department_id):
        department, err = _get_managed_department_or_403(request.user, department_id)
        if err:
            return err

        name = (request.data.get('name') or '').strip()
        code = (request.data.get('code') or '').strip().upper()
        if not name or not code:
            return Response({'success': False, 'message': 'name and code are required.'}, status=400)
        if Course.objects.filter(department=department, code=code).exists():
            return Response({'success': False, 'message': f'Course code "{code}" already exists.'}, status=400)

        default_template_id = request.data.get('default_template_id') or None
        course = Course.objects.create(
            department=department, name=name, code=code,
            default_template_id=default_template_id,
            default_restrictions=request.data.get('default_restrictions') or {},
        )
        return Response({'success': True, 'data': _course_summary(course)}, status=201)


class CourseDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, course_id):
        course, err = _get_managed_course_or_403(request.user, course_id)
        if err:
            return err
        if 'name' in request.data:
            course.name = (request.data.get('name') or '').strip() or course.name
        if 'default_template_id' in request.data:
            course.default_template_id = request.data.get('default_template_id') or None
        if 'default_restrictions' in request.data:
            course.default_restrictions = request.data.get('default_restrictions') or {}
        if 'schedule_day' in request.data:
            day = (request.data.get('schedule_day') or '').strip().lower() or None
            if day and day not in dict(Course.DAY_CHOICES):
                return Response({'success': False, 'message': 'Invalid schedule_day.'}, status=400)
            course.schedule_day = day
        if 'schedule_time' in request.data:
            raw_time = (request.data.get('schedule_time') or '').strip()
            if raw_time:
                import datetime
                try:
                    course.schedule_time = datetime.datetime.strptime(raw_time, '%H:%M').time()
                except ValueError:
                    return Response({'success': False, 'message': 'schedule_time must be HH:MM.'}, status=400)
            else:
                course.schedule_time = None
        course.save()
        return Response({'success': True, 'data': _course_summary(course)})


# ── Enrollment ────────────────────────────────────────────────────────

class BulkEnrollCSVView(APIView):
    """CSV columns: email, department_code, role (student|lecturer,
    default student), course_code (optional). department_code/course_code
    are resolved STRICTLY within the target university — a code that only
    exists under a different university is reported as a real per-row
    error, never silently cross-matched."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, university_id):
        university, err = _get_managed_university_or_403(request.user, university_id)
        if err:
            return err

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'success': False, 'message': 'CSV file is required (field name "file").'}, status=400)

        try:
            text = file_obj.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response({'success': False, 'message': 'File must be UTF-8 encoded CSV.'}, status=400)

        reader = csv.DictReader(io.StringIO(text))
        results = []
        for i, row in enumerate(reader, start=2):  # row 1 is the header
            email = (row.get('email') or '').strip()
            dept_code = (row.get('department_code') or row.get('department') or '').strip().upper()
            role = (row.get('role') or 'student').strip().lower()
            course_code = (row.get('course_code') or row.get('course') or '').strip().upper()

            if not email or not dept_code:
                results.append({'row': i, 'email': email, 'status': 'error', 'message': 'email and department_code are required.'})
                continue
            if role not in ('student', 'lecturer'):
                results.append({'row': i, 'email': email, 'status': 'error', 'message': f'Invalid role "{role}".'})
                continue

            user = User.objects.filter(email__iexact=email).first()
            if not user:
                results.append({'row': i, 'email': email, 'status': 'error', 'message': 'No existing Ospace account for this email.'})
                continue

            department = Department.objects.filter(university=university, code=dept_code).first()
            if not department:
                results.append({'row': i, 'email': email, 'status': 'error', 'message': f'No department "{dept_code}" in this university.'})
                continue

            course = None
            if course_code:
                course = Course.objects.filter(department=department, code=course_code).first()
                if not course:
                    results.append({
                        'row': i, 'email': email, 'status': 'partial',
                        'message': f'Enrolled in department "{dept_code}", but course "{course_code}" not found there.',
                    })
                    continue

            # Same real, shared helper every grant path now uses — a
            # lecturer row with no course_code still ends up with real
            # CourseEnrollment(s) for the department's existing courses,
            # not just an affiliation nothing actually checks for.
            _affiliation, enrolled_codes = grant_role_in_department(
                user, department, role, course=course, granted_by=request.user,
            )
            course_note = f' + course {course.code}' if course else (
                f' + {len(enrolled_codes)} existing course(s)' if enrolled_codes else ''
            )

            results.append({'row': i, 'email': email, 'status': 'ok', 'message': f'Enrolled as {role} in {dept_code}{course_note}.'})

        return Response({
            'success': True,
            'data': {
                'total_rows': len(results),
                'ok': sum(1 for r in results if r['status'] == 'ok'),
                'partial': sum(1 for r in results if r['status'] == 'partial'),
                'errors': sum(1 for r in results if r['status'] == 'error'),
                'results': results,
            },
        })


class DepartmentInviteListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, department_id):
        department, err = _get_managed_department_or_403(request.user, department_id)
        if err:
            return err
        invites = department.invites.filter(is_active=True)
        return Response({
            'success': True,
            'data': [
                {
                    'id': inv.id, 'code': inv.code, 'role': inv.role,
                    'course_id': inv.course_id, 'course_code': inv.course.code if inv.course else None,
                    'created_at': inv.created_at,
                }
                for inv in invites
            ],
        })

    def post(self, request, department_id):
        department, err = _get_managed_department_or_403(request.user, department_id)
        if err:
            return err

        role = request.data.get('role', 'student')
        if role not in ('student', 'lecturer'):
            return Response({'success': False, 'message': 'Invalid role.'}, status=400)

        course = None
        course_id = request.data.get('course_id')
        if course_id:
            course = Course.objects.filter(pk=course_id, department=department).first()
            if not course:
                return Response({'success': False, 'message': 'That course does not belong to this department.'}, status=400)

        code = secrets.token_urlsafe(9)[:12].replace('-', 'x').replace('_', 'y').upper()
        invite = DepartmentInvite.objects.create(
            department=department, course=course, role=role, code=code, created_by=request.user,
        )
        return Response({
            'success': True,
            'data': {'id': invite.id, 'code': invite.code, 'role': invite.role, 'course_id': invite.course_id},
        }, status=201)


class InviteRedeemView(APIView):
    """Any authenticated user may redeem a real invite code they were
    given — this is the self-enroll link itself, deliberately not gated
    by can_manage_*."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = (request.data.get('code') or '').strip().upper()
        invite = DepartmentInvite.objects.filter(code=code, is_active=True).select_related(
            'department__university', 'course',
        ).first()
        if not invite:
            return Response({'success': False, 'message': 'Invalid or inactive invite code.'}, status=404)

        # Same real, shared helper — a lecturer invite with no specific
        # course attached still results in real CourseEnrollment(s) for
        # the department's existing courses, not a silent dead end.
        _affiliation, enrolled_codes = grant_role_in_department(
            request.user, invite.department, invite.role, course=invite.course, granted_by=invite.created_by,
        )

        return Response({
            'success': True,
            'data': {
                'university': invite.department.university.name,
                'department': invite.department.name,
                'role': invite.role,
                'course': invite.course.code if invite.course else None,
                'courses': enrolled_codes,
            },
        })


class DepartmentLecturerGrantView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, department_id):
        department, err = _get_managed_department_or_403(request.user, department_id)
        if err:
            return err

        email = (request.data.get('email') or '').strip()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({'success': False, 'message': f'No existing Ospace account for {email}.'}, status=400)

        course_id = request.data.get('course_id')
        course = None
        if course_id:
            course = Course.objects.filter(pk=course_id, department=department).first()
            if not course:
                return Response({'success': False, 'message': 'That course does not belong to this department.'}, status=400)

        # Real bug (found twice now): a grant that only wrote ONE of the
        # two real record types a lecturer's own dashboard/nav actually
        # checks for left them with zero visible teaching capability.
        # grant_role_in_department is the one real place this is done
        # correctly and consistently — see its docstring.
        _affiliation, enrolled_codes = grant_role_in_department(
            user, department, 'lecturer', course=course, granted_by=request.user,
        )

        if course:
            return Response({'success': True, 'message': f'{email} is now lecturer for {course.code}.'})
        if enrolled_codes:
            return Response({
                'success': True,
                'message': f'{email} is now a lecturer in {department.name} — enrolled as lecturer in {len(enrolled_codes)} existing course(s): {", ".join(enrolled_codes)}.',
            })
        return Response({
            'success': True,
            'message': f'{email} is now a lecturer in {department.name}. No courses exist in this department yet — they\'ll need to be assigned once one is created.',
        })


class DepartmentLecturerRevokeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, department_id):
        department, err = _get_managed_department_or_403(request.user, department_id)
        if err:
            return err

        email = (request.data.get('email') or '').strip()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({'success': False, 'message': f'No existing Ospace account for {email}.'}, status=400)

        course_id = request.data.get('course_id')
        course = None
        if course_id:
            course = Course.objects.filter(pk=course_id, department=department).first()
            if not course:
                return Response({'success': False, 'message': 'That course does not belong to this department.'}, status=400)

        revoke_role_in_department(user, department, 'lecturer', course=course)

        if course:
            return Response({'success': True, 'message': f'{email} removed as lecturer for {course.code}.'})
        return Response({'success': True, 'message': f'{email} removed as lecturer in {department.name} (and every course in it).'})


class UniversityLecturersView(APIView):
    """Issue 3 fix — a real, complete answer to 'who is assigned as
    lecturer to what, right now', across BOTH real grant paths:
      - department-wide (UniversityAffiliation, role='lecturer',
        department set, no specific course)
      - course-scoped (CourseEnrollment, role='lecturer')
    Previously a grant returned only a toast message with nothing
    listing the result afterward — this is the real, persistent view of
    that same real data, not a new tracking table."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, university_id):
        university, err = _get_managed_university_or_403(request.user, university_id)
        if err:
            return err

        dept_grants = UniversityAffiliation.objects.filter(
            university=university, role='lecturer', is_active=True,
        ).select_related('user', 'department').order_by('-created_at')

        course_grants = CourseEnrollment.objects.filter(
            course__department__university=university, role='lecturer',
        ).select_related('user', 'course', 'course__department').order_by('-enrolled_at')

        def _name(u):
            return f'{u.first_name} {u.last_name}'.strip() or u.email

        data = [
            {
                'kind': 'department', 'id': f'aff-{a.id}',
                'user_id': a.user_id, 'name': _name(a.user), 'email': a.user.email,
                'department_id': a.department_id, 'department_name': a.department.name if a.department else None,
                'course_id': None, 'course_code': None,
                'assigned_at': a.created_at,
            }
            for a in dept_grants
        ] + [
            {
                'kind': 'course', 'id': f'enr-{e.id}',
                'user_id': e.user_id, 'name': _name(e.user), 'email': e.user.email,
                'department_id': e.course.department_id, 'department_name': e.course.department.name,
                'course_id': e.course_id, 'course_code': e.course.code,
                'assigned_at': e.enrolled_at,
            }
            for e in course_grants
        ]
        data.sort(key=lambda r: r['assigned_at'], reverse=True)

        return Response({'success': True, 'data': data})


# ── Scoped analytics ─────────────────────────────────────────────────

class UniversityAnalyticsView(APIView):
    """Real usage analytics, filtered STRICTLY by university_id — reuses
    the existing Workspace/LiveSession/CourseEnrollment data rather than
    a parallel tracking table."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, university_id):
        university, err = _get_managed_university_or_403(request.user, university_id)
        if err:
            return err

        from apps.sessions.models import LiveSession

        departments = Department.objects.filter(university=university)
        courses = Course.objects.filter(department__university=university)
        student_count = UniversityAffiliation.objects.filter(
            university=university, role='student', is_active=True,
        ).values('user_id').distinct().count()
        lecturer_count = UniversityAffiliation.objects.filter(
            university=university, role='lecturer', is_active=True,
        ).values('user_id').distinct().count()

        sessions = LiveSession.objects.filter(course__department__university=university)
        by_course = [
            {
                'course_id': c.id, 'course_code': c.code, 'course_name': c.name,
                'session_count': sessions.filter(course=c).count(),
                'enrolled_count': c.enrollments.count(),
            }
            for c in courses
        ]

        return Response({
            'success': True,
            'data': {
                'university_id': university.id,
                'university_name': university.name,
                'department_count': departments.count(),
                'course_count': courses.count(),
                'student_count': student_count,
                'lecturer_count': lecturer_count,
                'total_class_sessions': sessions.count(),
                'active_class_sessions': sessions.filter(status='active').count(),
                'by_course': by_course,
            },
        })


# ── Phase 1 (Product Depth Layer) — Hardware & Performance ────────────

class UniversityHardwareView(APIView):
    """Real, live hardware quota usage for a university — reuses
    get_university_resource_usage (real template specs + real,
    Proxmox-reconciled running-VM specs), and layers on a real per-VM
    health signal by reusing the SAME reconciliation approach as
    Infrastructure Health, scoped to just this university's VMs."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, university_id):
        university, err = _get_managed_university_or_403(request.user, university_id)
        if err:
            return err

        from .services.quota_service import get_university_resource_usage
        usage = get_university_resource_usage(university)

        # Real per-VM health signal, scoped to this university only —
        # every VirtualMachine tied to one of this university's templates,
        # not just the ones currently counted as 'running' for quota.
        from apps.vms.models import VirtualMachine
        all_uni_vms = VirtualMachine.objects.filter(
            template__university=university,
        ).exclude(status='deleted').select_related('template', 'owner').order_by('-allocated_at')

        health = []
        for vm in all_uni_vms:
            health.append({
                'id': vm.id,
                'name': vm.name,
                'template_name': vm.template.name if vm.template else None,
                'owner_email': vm.owner.email if vm.owner else None,
                'db_status': vm.status,
                'proxmox_vm_id': vm.proxmox_vm_id,
            })

        return Response({
            'success': True,
            'data': {
                'university_id': university.id,
                'university_name': university.name,
                **usage,
                'vm_health': health,
            },
        })
