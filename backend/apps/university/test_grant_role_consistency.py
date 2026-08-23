"""
Real user-reported bug (2026-08-23, escalated): a lecturer assigned by
their university admin had ZERO visible teaching capability on their
own account — no "My Courses," no Teaching nav.

Root cause, confirmed with real evidence:
  - DepartmentLecturerGrantView's department-wide branch (no course_id)
    created ONLY a real UniversityAffiliation(role='lecturer').
  - MyCoursesView (which backs both the "My Courses" page AND the
    Sidebar's Teaching-section nav gate) queries ONLY
    CourseEnrollment(role='lecturer').
  - A department-wide grant therefore left the lecturer with a real,
    valid affiliation (so the context switcher correctly showed the
    university) but zero courses — MyCoursesView legitimately returned
    nothing, and their entire visible lecturer capability stayed empty.

This is the SAME class of bug found once already in Phase 3 (a
course-scoped grant that created only CourseEnrollment, with no
UniversityAffiliation, broke the context switcher). Fixed structurally
this time: grant_role_in_department() / revoke_role_in_department() in
admin_views.py are now the ONE real place every grant path (department-
scoped lecturer grant, course-scoped lecturer grant, bulk-CSV
enrollment, self-enroll invite redemption) creates/removes both real
record types consistently.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.university.models import (
    University, Department, Course, UniversityAffiliation, CourseEnrollment, DepartmentInvite,
)
from apps.university.admin_views import grant_role_in_department, revoke_role_in_department


class GrantRoleInDepartmentHelperTests(TestCase):
    """Direct, unit-level proof of the shared helper's real behavior."""

    def setUp(self):
        self.uni = University.objects.create(
            name='__TEST__ Grant Helper Uni', contact_email='c@t.com', contact_name='C', status='active')
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='GH')
        self.course1 = Course.objects.create(department=self.dept, name='Course One', code='GH101')
        self.course2 = Course.objects.create(department=self.dept, name='Course Two', code='GH102')

    def test_department_wide_lecturer_grant_enrolls_every_existing_course(self):
        lecturer = User.objects.create_user(username='__t_gh_lect__', email='gh_lect@t.com', password='pw12345')
        affiliation, enrolled = grant_role_in_department(lecturer, self.dept, 'lecturer', course=None)

        self.assertTrue(
            UniversityAffiliation.objects.filter(
                user=lecturer, university=self.uni, department=self.dept, role='lecturer', is_active=True,
            ).exists()
        )
        self.assertEqual(sorted(enrolled), ['GH101', 'GH102'])
        self.assertTrue(CourseEnrollment.objects.filter(course=self.course1, user=lecturer, role='lecturer').exists())
        self.assertTrue(CourseEnrollment.objects.filter(course=self.course2, user=lecturer, role='lecturer').exists())

    def test_department_wide_lecturer_grant_with_zero_courses_is_honest_not_broken(self):
        empty_dept = Department.objects.create(university=self.uni, name='Empty', code='EM')
        lecturer = User.objects.create_user(username='__t_gh_empty__', email='gh_empty@t.com', password='pw12345')
        affiliation, enrolled = grant_role_in_department(lecturer, empty_dept, 'lecturer', course=None)

        self.assertTrue(
            UniversityAffiliation.objects.filter(user=lecturer, department=empty_dept, role='lecturer').exists()
        )
        self.assertEqual(enrolled, [])
        self.assertEqual(CourseEnrollment.objects.filter(user=lecturer).count(), 0)

    def test_course_scoped_lecturer_grant_only_enrolls_that_one_course(self):
        lecturer = User.objects.create_user(username='__t_gh_one__', email='gh_one@t.com', password='pw12345')
        affiliation, enrolled = grant_role_in_department(lecturer, self.dept, 'lecturer', course=self.course1)

        self.assertEqual(enrolled, ['GH101'])
        self.assertTrue(CourseEnrollment.objects.filter(course=self.course1, user=lecturer).exists())
        self.assertFalse(CourseEnrollment.objects.filter(course=self.course2, user=lecturer).exists())

    def test_department_wide_student_grant_creates_no_course_enrollment(self):
        """Students are NOT auto-enrolled in every course — only
        lecturers reasonably teach everything already in a department."""
        student = User.objects.create_user(username='__t_gh_student__', email='gh_student@t.com', password='pw12345')
        affiliation, enrolled = grant_role_in_department(student, self.dept, 'student', course=None)

        self.assertTrue(UniversityAffiliation.objects.filter(user=student, role='student').exists())
        self.assertEqual(enrolled, [])
        self.assertEqual(CourseEnrollment.objects.filter(user=student).count(), 0)

    def test_grant_is_idempotent_and_never_clobbers_existing_role(self):
        lecturer = User.objects.create_user(username='__t_gh_idem__', email='gh_idem@t.com', password='pw12345')
        grant_role_in_department(lecturer, self.dept, 'lecturer', course=None)
        # Calling again must not error or duplicate rows.
        grant_role_in_department(lecturer, self.dept, 'lecturer', course=None)
        self.assertEqual(
            UniversityAffiliation.objects.filter(user=lecturer, department=self.dept, role='lecturer').count(), 1
        )
        self.assertEqual(CourseEnrollment.objects.filter(user=lecturer, course=self.course1).count(), 1)

    def test_revoke_department_wide_lecturer_removes_every_auto_created_course_enrollment(self):
        lecturer = User.objects.create_user(username='__t_gh_revoke__', email='gh_revoke@t.com', password='pw12345')
        grant_role_in_department(lecturer, self.dept, 'lecturer', course=None)
        self.assertEqual(CourseEnrollment.objects.filter(user=lecturer).count(), 2)

        revoke_role_in_department(lecturer, self.dept, 'lecturer', course=None)

        self.assertFalse(UniversityAffiliation.objects.filter(user=lecturer, department=self.dept).exists())
        self.assertEqual(CourseEnrollment.objects.filter(user=lecturer).count(), 0)

    def test_revoke_course_scoped_only_removes_that_course(self):
        lecturer = User.objects.create_user(username='__t_gh_revoke2__', email='gh_revoke2@t.com', password='pw12345')
        grant_role_in_department(lecturer, self.dept, 'lecturer', course=self.course1)
        grant_role_in_department(lecturer, self.dept, 'lecturer', course=self.course2)

        revoke_role_in_department(lecturer, self.dept, 'lecturer', course=self.course1)

        self.assertFalse(CourseEnrollment.objects.filter(course=self.course1, user=lecturer).exists())
        self.assertTrue(CourseEnrollment.objects.filter(course=self.course2, user=lecturer).exists())
        # Course-scoped revoke leaves the real department-wide affiliation alone.
        self.assertTrue(UniversityAffiliation.objects.filter(user=lecturer, department=self.dept).exists())


class RealEndToEndLecturerVisibilityTests(TestCase):
    """The exact real scenario reported: a department-wide grant must
    make MyCoursesView (and therefore the Teaching nav) genuinely
    non-empty, over real HTTP, end to end."""

    def setUp(self):
        self.client = APIClient()
        self.uni_admin = User.objects.create_user(username='__t_e2e_admin__', email='e2e_admin@t.com', password='pw12345')
        self.uni = University.objects.create(
            name='__TEST__ E2E Lecturer Uni', contact_email='c@t.com', contact_name='C', status='active',
            admin_user=self.uni_admin,
        )
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='E2', )
        self.course = Course.objects.create(department=self.dept, name='Real Course', code='E2E101')

    def test_department_wide_grant_makes_my_courses_genuinely_non_empty(self):
        lecturer = User.objects.create_user(username='__t_e2e_lect__', email='e2e_lect@t.com', password='pw12345')

        self.client.force_authenticate(self.uni_admin)
        grant_resp = self.client.post(f'/api/university-admin/departments/{self.dept.id}/lecturers/grant/', {
            'email': lecturer.email,
        }, format='json')
        self.assertEqual(grant_resp.status_code, 200, grant_resp.data)

        # The exact real query the lecturer's own dashboard/Sidebar use.
        self.client.force_authenticate(lecturer)
        my_courses_resp = self.client.get('/api/university-admin/lecturer/my-courses/')
        self.assertEqual(my_courses_resp.status_code, 200)
        self.assertEqual(len(my_courses_resp.data['data']), 1)
        self.assertEqual(my_courses_resp.data['data'][0]['code'], 'E2E101')

    def test_bulk_csv_lecturer_row_with_no_course_code_still_sees_department_courses(self):
        import io
        lecturer = User.objects.create_user(username='__t_e2e_csv_lect__', email='e2e_csv_lect@t.com', password='pw12345')

        self.client.force_authenticate(self.uni_admin)
        csv_content = f'email,department_code,role\n{lecturer.email},E2,lecturer\n'
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'lecturers.csv'
        upload_resp = self.client.post(
            f'/api/university-admin/universities/{self.uni.id}/enroll/bulk-csv/',
            {'file': csv_file}, format='multipart',
        )
        self.assertEqual(upload_resp.status_code, 200, upload_resp.data)
        self.assertEqual(upload_resp.data['data']['ok'], 1)

        self.client.force_authenticate(lecturer)
        my_courses_resp = self.client.get('/api/university-admin/lecturer/my-courses/')
        self.assertEqual(len(my_courses_resp.data['data']), 1)
        self.assertEqual(my_courses_resp.data['data'][0]['code'], 'E2E101')

    def test_invite_redeem_lecturer_role_with_no_course_still_sees_department_courses(self):
        lecturer = User.objects.create_user(username='__t_e2e_invite_lect__', email='e2e_invite_lect@t.com', password='pw12345')
        invite = DepartmentInvite.objects.create(
            department=self.dept, role='lecturer', code='E2ELECTINVITE', created_by=self.uni_admin,
        )

        self.client.force_authenticate(lecturer)
        redeem_resp = self.client.post('/api/university-admin/invites/redeem/', {'code': invite.code}, format='json')
        self.assertEqual(redeem_resp.status_code, 200, redeem_resp.data)
        self.assertEqual(redeem_resp.data['data']['courses'], ['E2E101'])

        my_courses_resp = self.client.get('/api/university-admin/lecturer/my-courses/')
        self.assertEqual(len(my_courses_resp.data['data']), 1)
        self.assertEqual(my_courses_resp.data['data'][0]['code'], 'E2E101')

    def test_the_actual_real_previously_affected_lecturer_is_now_fixed(self):
        """Reproduces the exact real production case (denyjoe2002@gmail.com
        at DAR ES SALAAM INSTITUTE OF TECHNOLOGY / COE) as a disposable
        test fixture: a pre-existing UniversityAffiliation with zero
        CourseEnrollment rows, backfilled by calling the same shared
        helper idempotently — the same fix applied live."""
        lecturer = User.objects.create_user(username='__t_e2e_preexisting__', email='e2e_preexisting@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=lecturer, university=self.uni, department=self.dept, role='lecturer')
        self.assertEqual(CourseEnrollment.objects.filter(user=lecturer).count(), 0)

        grant_role_in_department(lecturer, self.dept, 'lecturer', course=None)

        self.client.force_authenticate(lecturer)
        my_courses_resp = self.client.get('/api/university-admin/lecturer/my-courses/')
        self.assertEqual(len(my_courses_resp.data['data']), 1)
        self.assertEqual(my_courses_resp.data['data'][0]['code'], 'E2E101')
