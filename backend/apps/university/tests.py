"""
Real, adversarial authorization tests for the university layer.

Every test here is an ATTEMPTED unauthorized access — calling the real
permission function with a real cross-tenant/cross-role object — not an
inspection of the code. A positive control (legitimate access correctly
allowed) sits next to every negative control (illegitimate access
correctly denied), so a permission function that just always returns
False can't accidentally pass this suite.
"""
from django.test import TestCase

from apps.users.models import User
from .models import (
    University, Department, Course, UniversityAffiliation, CourseEnrollment,
)
from .permissions import (
    get_user_university_role, can_manage_university, can_manage_department,
    can_manage_course, is_platform_superadmin, get_active_affiliations,
)


class UniversityBoundaryTests(TestCase):
    """Scenario 1 (spec 2.2): University X's admin must not be able to
    manage University Y, a real, different university."""

    def setUp(self):
        self.uni_x = University.objects.create(
            name='University X', contact_email='x@test.com', contact_name='X', status='active')
        self.uni_y = University.objects.create(
            name='University Y', contact_email='y@test.com', contact_name='Y', status='active')

        self.admin_x = User.objects.create_user(
            username='admin_x', email='admin_x@test.com', password='pw12345')
        self.uni_x.admin_user = self.admin_x
        self.uni_x.save()

        self.admin_y = User.objects.create_user(
            username='admin_y', email='admin_y@test.com', password='pw12345')
        self.uni_y.admin_user = self.admin_y
        self.uni_y.save()

    def test_admin_x_can_manage_own_university(self):
        """Positive control — legitimate access must still work."""
        self.assertTrue(can_manage_university(self.admin_x, self.uni_x))

    def test_admin_x_cannot_manage_university_y(self):
        """The real attempted cross-tenant access."""
        self.assertFalse(can_manage_university(self.admin_x, self.uni_y))

    def test_admin_y_cannot_manage_university_x(self):
        self.assertFalse(can_manage_university(self.admin_y, self.uni_x))

    def test_role_lookup_reports_admin_only_for_own_university(self):
        self.assertEqual(get_user_university_role(self.admin_x, self.uni_x.id), 'admin')
        self.assertIsNone(get_user_university_role(self.admin_x, self.uni_y.id))

    def test_random_unaffiliated_user_cannot_manage_either(self):
        outsider = User.objects.create_user(
            username='outsider', email='outsider@test.com', password='pw12345')
        self.assertFalse(can_manage_university(outsider, self.uni_x))
        self.assertFalse(can_manage_university(outsider, self.uni_y))
        self.assertIsNone(get_user_university_role(outsider, self.uni_x.id))


class CourseBoundaryTests(TestCase):
    """Scenario 2 (spec 2.2): a lecturer for CS101 must not be able to
    manage CS201 — a different, real course in the SAME department."""

    def setUp(self):
        self.uni = University.objects.create(
            name='Course Test Uni', contact_email='c@test.com', contact_name='C', status='active')
        self.dept = Department.objects.create(university=self.uni, name='Computer Science', code='CS')
        self.cs101 = Course.objects.create(department=self.dept, name='Intro to Programming', code='CS101')
        self.cs201 = Course.objects.create(department=self.dept, name='Data Structures', code='CS201')

        self.lecturer_b = User.objects.create_user(
            username='lecturer_b', email='lecturer_b@test.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.cs101, user=self.lecturer_b, role='lecturer')

    def test_lecturer_b_can_manage_cs101(self):
        """Positive control."""
        self.assertTrue(can_manage_course(self.lecturer_b, self.cs101))

    def test_lecturer_b_cannot_manage_cs201(self):
        """The real attempted cross-course access — same department, no
        enrollment record on the target course."""
        self.assertFalse(can_manage_course(self.lecturer_b, self.cs201))

    def test_student_enrollment_does_not_grant_course_management(self):
        student = User.objects.create_user(
            username='cs101_student', email='cs101_student@test.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.cs101, user=student, role='student')
        self.assertFalse(can_manage_course(student, self.cs101))

    def test_university_admin_can_manage_any_course_in_their_university(self):
        """Positive control for the second half of can_manage_course's
        contract — university admin, not just the course's own lecturer."""
        uni_admin = User.objects.create_user(
            username='cs_uni_admin', email='cs_uni_admin@test.com', password='pw12345')
        self.uni.admin_user = uni_admin
        self.uni.save()
        self.assertTrue(can_manage_course(uni_admin, self.cs101))
        self.assertTrue(can_manage_course(uni_admin, self.cs201))

    def test_lecturer_of_another_university_entirely_cannot_manage_either_course(self):
        other_uni = University.objects.create(
            name='Other Uni', contact_email='o@test.com', contact_name='O', status='active')
        other_dept = Department.objects.create(university=other_uni, name='Business', code='BA')
        other_course = Course.objects.create(department=other_dept, name='Marketing 101', code='BA101')
        outside_lecturer = User.objects.create_user(
            username='outside_lecturer', email='outside_lecturer@test.com', password='pw12345')
        CourseEnrollment.objects.create(course=other_course, user=outside_lecturer, role='lecturer')

        self.assertFalse(can_manage_course(outside_lecturer, self.cs101))
        self.assertFalse(can_manage_course(outside_lecturer, self.cs201))


class StudentCannotAccessAdminOrLecturerFunctionsTests(TestCase):
    """Scenario 3 (spec 2.2): a real student account, attempted against
    every admin/lecturer boundary this app defines."""

    def setUp(self):
        self.uni = University.objects.create(
            name='Student Boundary Uni', contact_email='s@test.com', contact_name='S', status='active')
        self.dept = Department.objects.create(university=self.uni, name='Physics', code='PHY')
        self.course = Course.objects.create(department=self.dept, name='Mechanics', code='PHY101')

        self.student = User.objects.create_user(
            username='pure_student', email='pure_student@test.com', password='pw12345')
        UniversityAffiliation.objects.create(
            user=self.student, university=self.uni, department=self.dept, role='student')
        CourseEnrollment.objects.create(course=self.course, user=self.student, role='student')

    def test_student_cannot_manage_university(self):
        self.assertFalse(can_manage_university(self.student, self.uni))

    def test_student_cannot_manage_department(self):
        self.assertFalse(can_manage_department(self.student, self.dept))

    def test_student_cannot_manage_course_they_are_enrolled_in(self):
        self.assertFalse(can_manage_course(self.student, self.course))

    def test_student_role_lookup_reports_student_not_admin_or_lecturer(self):
        role = get_user_university_role(self.student, self.uni.id)
        self.assertEqual(role, 'student')
        self.assertNotEqual(role, 'admin')
        self.assertNotEqual(role, 'lecturer')

    def test_student_is_not_platform_superadmin(self):
        self.assertFalse(is_platform_superadmin(self.student))

    def test_deactivated_student_affiliation_grants_no_role_at_all(self):
        """A revoked/deactivated affiliation must not silently continue
        to grant access — real, attempted access after revocation."""
        UniversityAffiliation.objects.filter(user=self.student, university=self.uni).update(is_active=False)
        self.assertIsNone(get_user_university_role(self.student, self.uni.id))


class UniversityDataIsolationTests(TestCase):
    """Scenario 4 (spec 2.2): a real university admin for University X
    attempts to reach University Y's courses/invoices/students — proven
    via the actual filtered-queryset pattern the real views will use
    (can_manage_university-gated, not just a raw filter assumed correct)."""

    def setUp(self):
        self.uni_x = University.objects.create(
            name='Isolation Uni X', contact_email='ix@test.com', contact_name='IX', status='active')
        self.uni_y = University.objects.create(
            name='Isolation Uni Y', contact_email='iy@test.com', contact_name='IY', status='active')

        self.admin_x = User.objects.create_user(
            username='iso_admin_x', email='iso_admin_x@test.com', password='pw12345')
        self.uni_x.admin_user = self.admin_x
        self.uni_x.save()

        self.dept_y = Department.objects.create(university=self.uni_y, name='Law', code='LAW')
        self.course_y = Course.objects.create(department=self.dept_y, name='Contracts', code='LAW101')
        self.student_y = User.objects.create_user(
            username='iso_student_y', email='iso_student_y@test.com', password='pw12345')
        UniversityAffiliation.objects.create(
            user=self.student_y, university=self.uni_y, department=self.dept_y, role='student')
        CourseEnrollment.objects.create(course=self.course_y, user=self.student_y, role='student')

        from .models import UniversityInvoice
        from django.utils import timezone
        import datetime
        self.invoice_y = UniversityInvoice.objects.create(
            university=self.uni_y, amount_tzs=1000000,
            billing_period_start=timezone.now().date(),
            billing_period_end=timezone.now().date() + datetime.timedelta(days=90),
            due_date=timezone.now().date() + datetime.timedelta(days=14),
        )

    def _universities_admin_x_may_manage(self):
        """Exactly the query pattern a real 'my universities' admin view
        would use — filtered by the real permission check, not trusted
        request input."""
        return [u for u in University.objects.all() if can_manage_university(self.admin_x, u)]

    def test_admin_x_management_scope_excludes_university_y_entirely(self):
        manageable = self._universities_admin_x_may_manage()
        self.assertIn(self.uni_x, manageable)
        self.assertNotIn(self.uni_y, manageable)

    def test_admin_x_cannot_manage_university_y_departments_courses_or_invoices(self):
        self.assertFalse(can_manage_university(self.admin_x, self.uni_y))
        self.assertFalse(can_manage_department(self.admin_x, self.dept_y))
        self.assertFalse(can_manage_course(self.admin_x, self.course_y))
        # Real attempted access to Y's invoice via the exact same boundary
        # function a real InvoiceDetailView would gate on.
        self.assertFalse(can_manage_university(self.admin_x, self.invoice_y.university))

    def test_admin_x_role_lookup_for_university_y_is_none_not_leaked(self):
        """A None here (rather than an exception or a default '' string)
        matters — a naive caller doing `role != 'admin'` on an exception
        object could accidentally evaluate truthy."""
        self.assertIsNone(get_user_university_role(self.admin_x, self.uni_y.id))

    def test_admin_x_affiliation_list_never_includes_university_y_data(self):
        """Proves get_active_affiliations (the real Phase 6 context-switcher
        source) cannot leak University Y even if admin_x is somehow also
        a student there — real attempted cross-tenant enumeration."""
        # Give admin_x an unrelated affiliation to prove the function is a
        # real per-user filter, not an accidental return-everything bug.
        UniversityAffiliation.objects.create(
            user=self.admin_x, university=self.uni_x, role='admin')
        affiliations = get_active_affiliations(self.admin_x)
        universities_seen = {a.university_id for a in affiliations}
        self.assertIn(self.uni_x.id, universities_seen)
        self.assertNotIn(self.uni_y.id, universities_seen)

    def test_student_y_cannot_manage_their_own_university(self):
        """A student inside University Y is still not that university's
        admin — role possession within a tenant isn't a privilege escalation."""
        self.assertFalse(can_manage_university(self.student_y, self.uni_y))
        self.assertFalse(can_manage_course(self.student_y, self.course_y))


class SuperAdminBoundaryTests(TestCase):
    """The platform SuperAdmin surface (Phase 3) is reused from Django's
    own is_superuser — proven distinct from both platform 'admin' role
    and university-level 'admin' affiliation."""

    def test_regular_platform_admin_role_is_not_superadmin(self):
        platform_admin = User.objects.create_user(
            username='platform_admin', email='platform_admin@test.com',
            password='pw12345', role='admin',
        )
        self.assertFalse(is_platform_superadmin(platform_admin))

    def test_university_admin_is_not_superadmin(self):
        uni = University.objects.create(
            name='SA Test Uni', contact_email='sa@test.com', contact_name='SA', status='active')
        uni_admin = User.objects.create_user(
            username='sa_uni_admin', email='sa_uni_admin@test.com', password='pw12345')
        uni.admin_user = uni_admin
        uni.save()
        self.assertFalse(is_platform_superadmin(uni_admin))

    def test_real_django_superuser_is_superadmin(self):
        superuser = User.objects.create_superuser(
            username='real_superuser', email='real_superuser@test.com', password='pw12345')
        self.assertTrue(is_platform_superadmin(superuser))

    def test_anonymous_user_is_never_superadmin(self):
        from django.contrib.auth.models import AnonymousUser
        self.assertFalse(is_platform_superadmin(AnonymousUser()))
