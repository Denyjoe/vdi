"""
Real user-reported issues (2026-08-23), fixed and tested here:

Issue 2 — SuperAdmin had no way to suspend/edit-terms/delete an
already-approved university. Built SuperAdminUniversitySuspendView /
ReactivateView / EditTermsView / DeleteView, real HTTP tests below,
including the real, live enforcement that a suspended university's
users are genuinely blocked from a new workspace launch (reusing the
SAME check_quota_allows enforcement points, not a parallel gate).

Issue 3 — a real lecturer assignment (UniversityAffiliation or
CourseEnrollment, both real, proven-working DB writes) was never shown
back anywhere after the fact. Built UniversityLecturersView plus real
lecturer names on the course summary; tested here.
"""
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.university.models import (
    University, Department, Course, UniversityAffiliation, CourseEnrollment,
)
from apps.university.services.quota_service import check_university_active


def _make_active_university(admin_user, **overrides):
    defaults = dict(
        name='__TEST__ Suspend University', contact_email='c@t.com', contact_name='C',
        status='active', admin_user=admin_user,
        seats_allocated=100, price_per_seat_tzs=Decimal('10000'), billing_cycle='semester',
        max_vcpu_cores=32, max_ram_gb=128, max_storage_gb=1000,
    )
    defaults.update(overrides)
    return University.objects.create(**defaults)


class UniversitySuspendReactivateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superadmin = User.objects.create_superuser(
            username='__t_suspend_superadmin__', email='suspend_superadmin@t.com', password='pw12345')
        self.regular_admin = User.objects.create_user(
            username='__t_suspend_regadmin__', email='suspend_regadmin@t.com', password='pw12345', role='admin')
        self.uni_admin = User.objects.create_user(
            username='__t_suspend_uniadmin__', email='suspend_uniadmin@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin)

    def tearDown(self):
        University.objects.filter(id=self.uni.id).delete()

    def test_superadmin_can_suspend_active_university(self):
        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{self.uni.id}/suspend/', {
            'reason': 'Non-payment — real test',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['data']['status'], 'suspended')
        self.uni.refresh_from_db()
        self.assertEqual(self.uni.status, 'suspended')

    def test_regular_platform_admin_cannot_suspend(self):
        """Real boundary — same separation proven for approve/reject."""
        self.client.force_authenticate(self.regular_admin)
        resp = self.client.post(f'/api/superadmin/university/universities/{self.uni.id}/suspend/', {}, format='json')
        self.assertEqual(resp.status_code, 403)
        self.uni.refresh_from_db()
        self.assertEqual(self.uni.status, 'active')

    def test_cannot_suspend_a_university_that_is_not_active(self):
        self.uni.status = 'suspended'
        self.uni.save()
        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{self.uni.id}/suspend/', {}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_suspension_genuinely_blocks_real_check_university_active(self):
        """Real, live enforcement — the same function called at both
        real enforcement points (workspace launch, session join)."""
        allowed, _ = check_university_active(self.uni)
        self.assertTrue(allowed)

        self.client.force_authenticate(self.superadmin)
        self.client.post(f'/api/superadmin/university/universities/{self.uni.id}/suspend/', {}, format='json')
        self.uni.refresh_from_db()

        allowed, message = check_university_active(self.uni)
        self.assertFalse(allowed)
        self.assertIn('suspended', message.lower())

    def test_reactivate_restores_real_active_status_and_check_passes_again(self):
        self.uni.status = 'suspended'
        self.uni.save()
        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{self.uni.id}/reactivate/', {}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['data']['status'], 'active')
        self.uni.refresh_from_db()
        allowed, _ = check_university_active(self.uni)
        self.assertTrue(allowed)

    def test_cannot_reactivate_a_university_that_is_not_suspended(self):
        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{self.uni.id}/reactivate/', {}, format='json')
        self.assertEqual(resp.status_code, 400)  # already active


class UniversityWorkspaceLaunchSuspendedTests(TestCase):
    """The real live-enforcement claim, end to end: a real user of a
    real suspended university genuinely cannot launch a real workspace
    against a real university-scoped template."""

    def setUp(self):
        self.client = APIClient()
        self.superadmin = User.objects.create_superuser(
            username='__t_launch_superadmin__', email='launch_superadmin@t.com', password='pw12345')
        self.uni_admin = User.objects.create_user(
            username='__t_launch_uniadmin__', email='launch_uniadmin@t.com', password='pw12345')
        self.student = User.objects.create_user(
            username='__t_launch_student__', email='launch_student@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin)
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='D1')

        from apps.vms.models import VMTemplate, Workspace
        self.template = VMTemplate.objects.create(
            name='__TEST__ Suspend Template', description='x', cpu_cores=2, ram_gb=4, storage_gb=20,
            os='Linux', university=self.uni,
        )
        UniversityAffiliation.objects.create(user=self.student, university=self.uni, role='student')
        self.workspace = Workspace.objects.create(owner=self.student, vm_template=self.template, name='ws')

    def tearDown(self):
        self.workspace.delete()
        self.template.delete()
        University.objects.filter(id=self.uni.id).delete()

    def test_workspace_launch_blocked_once_university_suspended(self):
        self.client.force_authenticate(self.superadmin)
        suspend_resp = self.client.post(f'/api/superadmin/university/universities/{self.uni.id}/suspend/', {}, format='json')
        self.assertEqual(suspend_resp.status_code, 200, suspend_resp.data)

        self.client.force_authenticate(self.student)
        launch_resp = self.client.post(f'/api/workspaces/{self.workspace.id}/launch/', {}, format='json')
        self.assertEqual(launch_resp.status_code, 409, launch_resp.data)
        self.assertIn('suspended', launch_resp.data['message'].lower())


class UniversityEditTermsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superadmin = User.objects.create_superuser(
            username='__t_terms_superadmin__', email='terms_superadmin@t.com', password='pw12345')
        self.uni_admin = User.objects.create_user(
            username='__t_terms_uniadmin__', email='terms_uniadmin@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin)

    def tearDown(self):
        University.objects.filter(id=self.uni.id).delete()

    def test_superadmin_can_edit_real_negotiated_terms(self):
        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{self.uni.id}/edit-terms/', {
            'seats_allocated': 500,
            'price_per_seat_tzs': '12500.50',
            'max_vcpu_cores': 64,
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.uni.refresh_from_db()
        self.assertEqual(self.uni.seats_allocated, 500)
        self.assertEqual(self.uni.price_per_seat_tzs, Decimal('12500.50'))
        self.assertEqual(self.uni.max_vcpu_cores, 64)
        # Untouched fields stay untouched.
        self.assertEqual(self.uni.max_ram_gb, 128)

    def test_edit_terms_rejects_invalid_values_without_partial_write(self):
        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{self.uni.id}/edit-terms/', {
            'seats_allocated': -5,
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.uni.refresh_from_db()
        self.assertEqual(self.uni.seats_allocated, 100)  # unchanged

    def test_regular_admin_cannot_edit_terms(self):
        regular_admin = User.objects.create_user(
            username='__t_terms_regadmin__', email='terms_regadmin@t.com', password='pw12345', role='admin')
        self.client.force_authenticate(regular_admin)
        resp = self.client.post(f'/api/superadmin/university/universities/{self.uni.id}/edit-terms/', {
            'seats_allocated': 999,
        }, format='json')
        self.assertEqual(resp.status_code, 403)


class UniversityDeleteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superadmin = User.objects.create_superuser(
            username='__t_del_superadmin__', email='del_superadmin@t.com', password='pw12345')
        self.uni_admin = User.objects.create_user(
            username='__t_del_uniadmin__', email='del_uniadmin@t.com', password='pw12345')

    def test_delete_requires_exact_typed_name_confirmation(self):
        uni = _make_active_university(self.uni_admin, name='__TEST__ Delete Uni A')
        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{uni.id}/delete/', {
            'confirm_name': 'wrong name entirely',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(University.objects.filter(id=uni.id).exists())
        uni.delete()

    def test_delete_blocked_when_active_students_exist(self):
        uni = _make_active_university(self.uni_admin, name='__TEST__ Delete Uni B')
        student = User.objects.create_user(username='__t_del_student__', email='del_student@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=student, university=uni, role='student')

        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{uni.id}/delete/', {
            'confirm_name': uni.name,
        }, format='json')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('student', resp.data['message'].lower())
        self.assertTrue(University.objects.filter(id=uni.id).exists())
        uni.delete()

    def test_delete_blocked_when_running_vm_exists(self):
        uni = _make_active_university(self.uni_admin, name='__TEST__ Delete Uni C')
        from apps.vms.models import VMTemplate, VirtualMachine
        template = VMTemplate.objects.create(
            name='__TEST__ Del Template', description='x', cpu_cores=2, ram_gb=4, storage_gb=20,
            os='Linux', university=uni,
        )
        owner = User.objects.create_user(username='__t_del_owner__', email='del_owner@t.com', password='pw12345')
        vm = VirtualMachine.objects.create(name='vm', owner=owner, template=template, status='running')

        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{uni.id}/delete/', {
            'confirm_name': uni.name,
        }, format='json')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('running', resp.data['message'].lower())

        vm.delete()
        template.delete()
        uni.delete()

    def test_delete_blocked_when_templates_still_exist_even_with_no_students_or_running_vms(self):
        """The subtle, real risk: VMTemplate.university is SET_NULL, so
        an unblocked delete would silently make a university-scoped
        template platform-wide. Must be blocked regardless of students."""
        uni = _make_active_university(self.uni_admin, name='__TEST__ Delete Uni D')
        from apps.vms.models import VMTemplate
        template = VMTemplate.objects.create(
            name='__TEST__ Del Template Idle', description='x', cpu_cores=2, ram_gb=4, storage_gb=20,
            os='Linux', university=uni,
        )

        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{uni.id}/delete/', {
            'confirm_name': uni.name,
        }, format='json')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('template', resp.data['message'].lower())

        template.delete()
        uni.delete()

    def test_genuinely_empty_university_can_be_deleted_and_real_cascade_happens(self):
        uni = _make_active_university(self.uni_admin, name='__TEST__ Delete Uni Empty')
        dept = Department.objects.create(university=uni, name='Dept', code='DE')
        course = Course.objects.create(department=dept, name='Course', code='C1')
        uni_id = uni.id
        dept_id = dept.id
        course_id = course.id

        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(f'/api/superadmin/university/universities/{uni.id}/delete/', {
            'confirm_name': uni.name,
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertFalse(University.objects.filter(id=uni_id).exists())
        self.assertFalse(Department.objects.filter(id=dept_id).exists())
        self.assertFalse(Course.objects.filter(id=course_id).exists())

    def test_regular_admin_cannot_delete(self):
        uni = _make_active_university(self.uni_admin, name='__TEST__ Delete Uni E')
        regular_admin = User.objects.create_user(
            username='__t_del_regadmin__', email='del_regadmin@t.com', password='pw12345', role='admin')
        self.client.force_authenticate(regular_admin)
        resp = self.client.post(f'/api/superadmin/university/universities/{uni.id}/delete/', {
            'confirm_name': uni.name,
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(University.objects.filter(id=uni.id).exists())
        uni.delete()


class UniversityLecturersVisibilityTests(TestCase):
    """Issue 3 — a real lecturer assignment must be genuinely visible
    afterward, both in a real 'who teaches what' list and on the
    specific course's own detail data."""

    def setUp(self):
        self.client = APIClient()
        self.uni_admin = User.objects.create_user(
            username='__t_lect_uniadmin__', email='lect_uniadmin@t.com', password='pw12345')
        self.other_admin = User.objects.create_user(
            username='__t_lect_otheradmin__', email='lect_otheradmin@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin, name='__TEST__ Lecturers Uni')
        self.other_uni = _make_active_university(self.other_admin, name='__TEST__ Lecturers Other Uni')
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='LD')
        self.course = Course.objects.create(department=self.dept, name='Course', code='LC101')

    def tearDown(self):
        University.objects.filter(id__in=[self.uni.id, self.other_uni.id]).delete()

    def test_department_wide_grant_appears_in_real_lecturers_list(self):
        lecturer = User.objects.create_user(username='__t_lect_dept__', email='lect_dept@t.com', password='pw12345')
        self.client.force_authenticate(self.uni_admin)
        grant_resp = self.client.post(f'/api/university-admin/departments/{self.dept.id}/lecturers/grant/', {
            'email': lecturer.email,
        }, format='json')
        self.assertEqual(grant_resp.status_code, 200, grant_resp.data)

        # Real fix (lecturer-visibility bug): a department-wide grant now
        # ALSO enrolls every real, existing course in that department —
        # this setUp's self.course ('LC101') is one — so BOTH the real
        # department-wide row and a real course-scoped row show up here.
        list_resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/lecturers/')
        self.assertEqual(list_resp.status_code, 200)
        rows = list_resp.data['data']
        self.assertEqual(len(rows), 2)
        dept_rows = [r for r in rows if r['kind'] == 'department']
        course_rows = [r for r in rows if r['kind'] == 'course']
        self.assertEqual(len(dept_rows), 1)
        self.assertEqual(dept_rows[0]['email'], lecturer.email)
        self.assertEqual(dept_rows[0]['department_id'], self.dept.id)
        self.assertEqual(len(course_rows), 1)
        self.assertEqual(course_rows[0]['email'], lecturer.email)
        self.assertEqual(course_rows[0]['course_code'], 'LC101')

    def test_course_scoped_grant_appears_in_lecturers_list_and_on_course_summary(self):
        lecturer = User.objects.create_user(
            username='__t_lect_course__', email='lect_course@t.com', password='pw12345',
            first_name='Real', last_name='Lecturer')
        self.client.force_authenticate(self.uni_admin)
        grant_resp = self.client.post(f'/api/university-admin/departments/{self.dept.id}/lecturers/grant/', {
            'email': lecturer.email, 'course_id': self.course.id,
        }, format='json')
        self.assertEqual(grant_resp.status_code, 200, grant_resp.data)

        # 1. Real "who teaches what" list. A course-scoped grant also
        # creates a real department-wide UniversityAffiliation (the
        # existing Phase 3 fix that makes the account's own "Teaching"
        # context-switcher entry reachable) — so both real rows show up,
        # one per real underlying assignment.
        list_resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/lecturers/')
        self.assertEqual(list_resp.status_code, 200)
        rows = list_resp.data['data']
        self.assertEqual(len(rows), 2)
        course_rows = [r for r in rows if r['kind'] == 'course']
        self.assertEqual(len(course_rows), 1)
        self.assertEqual(course_rows[0]['course_id'], self.course.id)
        self.assertEqual(course_rows[0]['course_code'], 'LC101')
        self.assertEqual(course_rows[0]['name'], 'Real Lecturer')

        # 2. Real course detail data now names the lecturer, not just a count.
        course_resp = self.client.get(f'/api/university-admin/departments/{self.dept.id}/courses/')
        self.assertEqual(course_resp.status_code, 200)
        course_row = course_resp.data['data'][0]
        self.assertEqual(course_row['lecturer_count'], 1)
        self.assertEqual(len(course_row['lecturers']), 1)
        self.assertEqual(course_row['lecturers'][0]['email'], lecturer.email)

    def test_lecturers_list_never_leaks_another_universitys_assignments(self):
        other_dept = Department.objects.create(university=self.other_uni, name='OtherDept', code='OD')
        other_lecturer = User.objects.create_user(
            username='__t_lect_other__', email='lect_other@t.com', password='pw12345')
        self.client.force_authenticate(self.other_admin)
        self.client.post(f'/api/university-admin/departments/{other_dept.id}/lecturers/grant/', {
            'email': other_lecturer.email,
        }, format='json')

        self.client.force_authenticate(self.uni_admin)
        list_resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/lecturers/')
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(list_resp.data['data'], [])

    def test_admin_x_cannot_list_lecturers_for_university_y(self):
        self.client.force_authenticate(self.other_admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/lecturers/')
        self.assertEqual(resp.status_code, 403)

    def test_revoke_removes_lecturer_from_the_real_list(self):
        lecturer = User.objects.create_user(username='__t_lect_revoke__', email='lect_revoke@t.com', password='pw12345')
        self.client.force_authenticate(self.uni_admin)
        self.client.post(f'/api/university-admin/departments/{self.dept.id}/lecturers/grant/', {
            'email': lecturer.email,
        }, format='json')
        revoke_resp = self.client.post(f'/api/university-admin/departments/{self.dept.id}/lecturers/revoke/', {
            'email': lecturer.email,
        }, format='json')
        self.assertEqual(revoke_resp.status_code, 200, revoke_resp.data)

        list_resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/lecturers/')
        self.assertEqual(list_resp.data['data'], [])
