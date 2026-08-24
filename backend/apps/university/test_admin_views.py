"""
Phase 4 — real, adversarial HTTP-level tests for the University Admin
Dashboard. The specific scenario requested: prove a real university
admin's department (and course, invite, analytics, bulk-enroll) list/
write views genuinely cannot be tricked into touching another
university's data via a crafted request — not assumed safe because the
permission function was already proven correct in isolation (Phase 2).
Every test here calls the real, wired-up URL with a real object id that
belongs to a DIFFERENT tenant and checks both the HTTP status AND that
nothing was created/changed as a side effect.
"""
import io

from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from .models import (
    University, Department, Course, UniversityAffiliation, CourseEnrollment, DepartmentInvite,
)


class CrossTenantIsolationTests(TestCase):
    """University X's admin, attempted against every real University Y
    object/endpoint in this dashboard."""

    def setUp(self):
        self.client = APIClient()

        self.uni_x = University.objects.create(
            name='__TEST__ Uni X', contact_email='x@t.com', contact_name='X', status='active')
        self.uni_y = University.objects.create(
            name='__TEST__ Uni Y', contact_email='y@t.com', contact_name='Y', status='active')

        self.admin_x = User.objects.create_user(username='__t_admin_x__', email='admin_x@t.com', password='pw12345')
        self.uni_x.admin_user = self.admin_x
        self.uni_x.save()

        self.admin_y = User.objects.create_user(username='__t_admin_y__', email='admin_y@t.com', password='pw12345')
        self.uni_y.admin_user = self.admin_y
        self.uni_y.save()

        self.dept_x = Department.objects.create(university=self.uni_x, name='CS X', code='CSX')
        self.dept_y = Department.objects.create(university=self.uni_y, name='CS Y', code='CSY')
        self.course_x = Course.objects.create(department=self.dept_x, name='Intro X', code='X101')
        self.course_y = Course.objects.create(department=self.dept_y, name='Intro Y', code='Y101')

        self.client.force_authenticate(self.admin_x)

    # ── The exact scenario requested: department list via crafted request ──

    def test_crafted_department_list_for_other_university_is_blocked(self):
        resp = self.client.get(f'/api/university-admin/universities/{self.uni_y.id}/departments/')
        self.assertEqual(resp.status_code, 403)
        # No department data of any kind leaked in the error response.
        self.assertNotIn('data', resp.data)

    def test_own_department_list_works_and_only_shows_own_departments(self):
        """Positive control, and proves the list is genuinely scoped —
        not just permission-denied for everything."""
        resp = self.client.get(f'/api/university-admin/universities/{self.uni_x.id}/departments/')
        self.assertEqual(resp.status_code, 200)
        codes = [d['code'] for d in resp.data['data']]
        self.assertIn('CSX', codes)
        self.assertNotIn('CSY', codes)

    def test_crafted_department_create_for_other_university_is_blocked(self):
        before = Department.objects.filter(university=self.uni_y).count()
        resp = self.client.post(f'/api/university-admin/universities/{self.uni_y.id}/departments/', {
            'name': 'Injected Dept', 'code': 'HACK',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(Department.objects.filter(university=self.uni_y).count(), before)
        self.assertFalse(Department.objects.filter(university=self.uni_y, code='HACK').exists())

    def test_crafted_department_update_for_other_universitys_department_is_blocked(self):
        resp = self.client.patch(f'/api/university-admin/departments/{self.dept_y.id}/', {
            'name': 'Renamed By Attacker',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.dept_y.refresh_from_db()
        self.assertEqual(self.dept_y.name, 'CS Y')  # untouched

    def test_crafted_course_list_for_other_universitys_department_is_blocked(self):
        resp = self.client.get(f'/api/university-admin/departments/{self.dept_y.id}/courses/')
        self.assertEqual(resp.status_code, 403)
        self.assertNotIn('data', resp.data)

    def test_crafted_course_create_under_other_universitys_department_is_blocked(self):
        before = Course.objects.filter(department=self.dept_y).count()
        resp = self.client.post(f'/api/university-admin/departments/{self.dept_y.id}/courses/', {
            'name': 'Injected Course', 'code': 'HACK101',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(Course.objects.filter(department=self.dept_y).count(), before)

    def test_crafted_course_update_for_other_universitys_course_is_blocked(self):
        resp = self.client.patch(f'/api/university-admin/courses/{self.course_y.id}/', {
            'name': 'Renamed By Attacker',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.course_y.refresh_from_db()
        self.assertEqual(self.course_y.name, 'Intro Y')

    def test_crafted_invite_creation_for_other_universitys_department_is_blocked(self):
        before = DepartmentInvite.objects.filter(department=self.dept_y).count()
        resp = self.client.post(f'/api/university-admin/departments/{self.dept_y.id}/invites/', {
            'role': 'student',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(DepartmentInvite.objects.filter(department=self.dept_y).count(), before)

    def test_crafted_invite_list_for_other_universitys_department_is_blocked(self):
        DepartmentInvite.objects.create(department=self.dept_y, role='student', code='REALYCODE1', created_by=self.admin_y)
        resp = self.client.get(f'/api/university-admin/departments/{self.dept_y.id}/invites/')
        self.assertEqual(resp.status_code, 403)
        self.assertNotIn('data', resp.data)

    def test_crafted_lecturer_grant_on_other_universitys_department_is_blocked(self):
        target = User.objects.create_user(username='__t_target__', email='target@t.com', password='pw12345')
        resp = self.client.post(f'/api/university-admin/departments/{self.dept_y.id}/lecturers/grant/', {
            'email': target.email,
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(
            UniversityAffiliation.objects.filter(user=target, university=self.uni_y, role='lecturer').exists()
        )

    def test_crafted_analytics_request_for_other_university_is_blocked(self):
        resp = self.client.get(f'/api/university-admin/universities/{self.uni_y.id}/analytics/')
        self.assertEqual(resp.status_code, 403)
        self.assertNotIn('data', resp.data)

    def test_crafted_bulk_csv_cannot_cross_university_boundary_via_department_code(self):
        """The trickiest crafted request: admin_x runs a bulk-CSV enroll
        scoped to THEIR OWN university (so the outer permission check
        passes), but references a department_code that only exists under
        University Y — the row must be rejected, not silently matched
        against Y's real department."""
        target = User.objects.create_user(username='__t_bulk_target__', email='bulk_target@t.com', password='pw12345')
        csv_content = f'email,department_code,role\n{target.email},CSY,student\n'
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'enroll.csv'

        resp = self.client.post(
            f'/api/university-admin/universities/{self.uni_x.id}/enroll/bulk-csv/',
            {'file': csv_file}, format='multipart',
        )
        self.assertEqual(resp.status_code, 200)
        row = resp.data['data']['results'][0]
        self.assertEqual(row['status'], 'error')
        self.assertIn('No department', row['message'])
        # Confirm no affiliation was created anywhere for this user.
        self.assertFalse(UniversityAffiliation.objects.filter(user=target).exists())

    def test_admin_y_symmetric_checks_against_x(self):
        """Same boundary, opposite direction — proves this isn't a
        one-way accident of setup ordering."""
        self.client.force_authenticate(self.admin_y)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni_x.id}/departments/')
        self.assertEqual(resp.status_code, 403)
        resp2 = self.client.patch(f'/api/university-admin/departments/{self.dept_x.id}/', {'name': 'Hacked'}, format='json')
        self.assertEqual(resp2.status_code, 403)
        self.dept_x.refresh_from_db()
        self.assertEqual(self.dept_x.name, 'CS X')


class RealDashboardFlowTests(TestCase):
    """Positive, end-to-end proof of the features themselves working —
    department, course, bulk CSV, invite redemption, lecturer grant,
    scoped analytics — all through the real HTTP layer."""

    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Flow Uni', contact_email='f@t.com', contact_name='F', status='active')
        self.admin = User.objects.create_user(username='__t_flow_admin__', email='flow_admin@t.com', password='pw12345')
        self.uni.admin_user = self.admin
        self.uni.save()
        self.client.force_authenticate(self.admin)

    def test_full_department_course_flow(self):
        dept_resp = self.client.post(f'/api/university-admin/universities/{self.uni.id}/departments/', {
            'name': 'Engineering', 'code': 'ENG',
        }, format='json')
        self.assertEqual(dept_resp.status_code, 201)
        dept_id = dept_resp.data['data']['id']

        course_resp = self.client.post(f'/api/university-admin/departments/{dept_id}/courses/', {
            'name': 'Circuits 101', 'code': 'ENG101',
        }, format='json')
        self.assertEqual(course_resp.status_code, 201)
        course_id = course_resp.data['data']['id']

        list_resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/departments/')
        self.assertEqual(len(list_resp.data['data']), 1)
        self.assertEqual(list_resp.data['data'][0]['course_count'], 1)

        patch_resp = self.client.patch(f'/api/university-admin/courses/{course_id}/', {'name': 'Circuits I'}, format='json')
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.data['data']['name'], 'Circuits I')

    def test_bulk_csv_real_success_and_partial_and_missing_account(self):
        dept = Department.objects.create(university=self.uni, name='Business', code='BUS')
        course = Course.objects.create(department=dept, name='Accounting', code='BUS101')
        existing_user = User.objects.create_user(username='__t_bulk_ok__', email='bulk_ok@t.com', password='pw12345')

        csv_content = (
            'email,department_code,role,course_code\n'
            f'{existing_user.email},BUS,student,BUS101\n'
            'ghost_never_signed_up@t.com,BUS,student,\n'
            f'{existing_user.email},NOPE,student,\n'
        )
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'enroll.csv'

        resp = self.client.post(
            f'/api/university-admin/universities/{self.uni.id}/enroll/bulk-csv/',
            {'file': csv_file}, format='multipart',
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.data['data']
        self.assertEqual(data['total_rows'], 3)
        self.assertEqual(data['ok'], 1)
        self.assertEqual(data['errors'], 2)

        self.assertTrue(
            CourseEnrollment.objects.filter(course=course, user=existing_user, role='student').exists()
        )
        self.assertTrue(
            UniversityAffiliation.objects.filter(user=existing_user, university=self.uni, department=dept).exists()
        )

    def test_invite_creation_and_real_redemption(self):
        dept = Department.objects.create(university=self.uni, name='Law', code='LAW')
        invite_resp = self.client.post(f'/api/university-admin/departments/{dept.id}/invites/', {
            'role': 'student',
        }, format='json')
        self.assertEqual(invite_resp.status_code, 201)
        code = invite_resp.data['data']['code']

        newcomer = User.objects.create_user(username='__t_newcomer__', email='newcomer@t.com', password='pw12345')
        self.client.force_authenticate(newcomer)
        redeem_resp = self.client.post('/api/university-admin/invites/redeem/', {'code': code}, format='json')
        self.assertEqual(redeem_resp.status_code, 200)

        self.assertTrue(
            UniversityAffiliation.objects.filter(
                user=newcomer, university=self.uni, department=dept, role='student', is_active=True,
            ).exists()
        )

    def test_invalid_invite_code_rejected(self):
        someone = User.objects.create_user(username='__t_someone__', email='someone@t.com', password='pw12345')
        self.client.force_authenticate(someone)
        resp = self.client.post('/api/university-admin/invites/redeem/', {'code': 'NOTREALCODE'}, format='json')
        self.assertEqual(resp.status_code, 404)

    def test_lecturer_grant_and_revoke_department_scoped(self):
        dept = Department.objects.create(university=self.uni, name='Arts', code='ART')
        target = User.objects.create_user(username='__t_lect_target__', email='lect_target@t.com', password='pw12345')

        grant_resp = self.client.post(f'/api/university-admin/departments/{dept.id}/lecturers/grant/', {
            'email': target.email,
        }, format='json')
        self.assertEqual(grant_resp.status_code, 200)
        self.assertTrue(
            UniversityAffiliation.objects.filter(
                user=target, university=self.uni, department=dept, role='lecturer',
            ).exists()
        )

        revoke_resp = self.client.post(f'/api/university-admin/departments/{dept.id}/lecturers/revoke/', {
            'email': target.email,
        }, format='json')
        self.assertEqual(revoke_resp.status_code, 200)
        self.assertFalse(
            UniversityAffiliation.objects.filter(
                user=target, university=self.uni, department=dept, role='lecturer',
            ).exists()
        )

    def test_course_scoped_lecturer_grant_also_creates_real_university_affiliation(self):
        """Real bug found during the Phase 3 context-isolation audit: a
        course-scoped grant (course_id given) used to create ONLY the
        CourseEnrollment row. get_active_affiliations() — the real
        source the account-context switcher reads — only ever queries
        UniversityAffiliation, so a lecturer granted access to a single
        course (not department-wide) could never actually switch into
        that university's context at all: their own real "Teaching" nav
        section would be permanently unreachable."""
        dept = Department.objects.create(university=self.uni, name='Bio', code='BIO')
        course = Course.objects.create(department=dept, name='Genetics', code='BIO301')
        target = User.objects.create_user(username='__t_course_lect_target__', email='course_lect_target@t.com', password='pw12345')

        grant_resp = self.client.post(f'/api/university-admin/departments/{dept.id}/lecturers/grant/', {
            'email': target.email, 'course_id': course.id,
        }, format='json')
        self.assertEqual(grant_resp.status_code, 200, grant_resp.data)

        self.assertTrue(
            CourseEnrollment.objects.filter(course=course, user=target, role='lecturer').exists()
        )
        self.assertTrue(
            UniversityAffiliation.objects.filter(
                user=target, university=self.uni, department=dept, role='lecturer', is_active=True,
            ).exists()
        )

        from apps.university.permissions import get_active_affiliations
        affiliations = get_active_affiliations(target)
        self.assertEqual(len(affiliations), 1)
        self.assertEqual(affiliations[0].university_id, self.uni.id)

    def test_scoped_analytics_real_counts(self):
        dept = Department.objects.create(university=self.uni, name='Med', code='MED')
        course = Course.objects.create(department=dept, name='Anatomy', code='MED101')
        student = User.objects.create_user(username='__t_analytics_student__', email='analytics_student@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=course, user=student, role='student')
        UniversityAffiliation.objects.create(user=student, university=self.uni, department=dept, role='student')

        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/analytics/')
        self.assertEqual(resp.status_code, 200)
        data = resp.data['data']
        self.assertEqual(data['department_count'], 1)
        self.assertEqual(data['course_count'], 1)
        self.assertEqual(data['student_count'], 1)
        self.assertEqual(data['by_course'][0]['course_code'], 'MED101')
        self.assertEqual(data['by_course'][0]['enrolled_count'], 1)

    def test_student_cannot_use_any_dashboard_endpoint_even_in_own_university(self):
        """A student affiliated with THIS university still isn't the
        university's admin — role possession isn't privilege."""
        dept = Department.objects.create(university=self.uni, name='Isolated Dept', code='ISO')
        student = User.objects.create_user(username='__t_pure_student__', email='pure_student@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=student, university=self.uni, department=dept, role='student')

        self.client.force_authenticate(student)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/departments/')
        self.assertEqual(resp.status_code, 403)
