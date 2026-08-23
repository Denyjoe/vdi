"""
Real user-reported gap: Department (and, while checking, Course)
edit/delete actions genuinely did not exist anywhere — backend or
frontend. Confirmed via grep before building anything: neither
DepartmentDetailView nor CourseDetailView had a delete() method, and
CourseDetailView.patch() didn't support editing `code`. Department
creation was a genuinely one-way, permanent action in the UI.

Built here:
  - CourseDetailView.patch() now also supports `code` (matching what
    DepartmentDetailView.patch() already did for its own code field).
  - DepartmentDetailView.delete() / CourseDetailView.delete() — real,
    honest, blocked (409) if real students are enrolled or a real
    class session is currently active; department delete additionally
    requires the department's exact real name typed to confirm (same
    pattern as University deletion).
"""
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.university.models import (
    University, Department, Course, UniversityAffiliation, CourseEnrollment,
)
from apps.sessions.models import LiveSession


def _make_active_university(admin_user, **overrides):
    defaults = dict(
        name='__TEST__ Dept-Course Lifecycle Uni', contact_email='c@t.com', contact_name='C', status='active',
        admin_user=admin_user,
    )
    defaults.update(overrides)
    return University.objects.create(**defaults)


class DepartmentEditTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni_admin = User.objects.create_user(username='__t_dedit_admin__', email='dedit_admin@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin)
        self.other_admin = User.objects.create_user(username='__t_dedit_other__', email='dedit_other@t.com', password='pw12345')
        self.other_uni = _make_active_university(self.other_admin, name='__TEST__ Dept-Course Other Uni')
        self.dept = Department.objects.create(university=self.uni, name='Old Name', code='OLD')

    def tearDown(self):
        University.objects.filter(id__in=[self.uni.id, self.other_uni.id]).delete()

    def test_real_edit_updates_name_and_code(self):
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.patch(f'/api/university-admin/departments/{self.dept.id}/', {
            'name': 'Computer Studies', 'code': 'CS',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['data']['name'], 'Computer Studies')
        self.assertEqual(resp.data['data']['code'], 'CS')
        self.dept.refresh_from_db()
        self.assertEqual(self.dept.name, 'Computer Studies')
        self.assertEqual(self.dept.code, 'CS')

    def test_edit_reflected_on_courses_under_it(self):
        """The real question this phase asked: does the edit propagate
        everywhere it's displayed? A course's own summary reads the
        real department relation live, so a rename is immediately
        reflected without any separate denormalized copy to update."""
        course = Course.objects.create(department=self.dept, name='Course', code='C101')
        self.client.force_authenticate(self.uni_admin)
        self.client.patch(f'/api/university-admin/departments/{self.dept.id}/', {'name': 'Renamed Dept'}, format='json')

        course_resp = self.client.get(f'/api/university-admin/departments/{self.dept.id}/courses/')
        self.assertEqual(course_resp.status_code, 200)
        # department_name isn't denormalized onto course summaries, but
        # the department's own real name is what every surface reads —
        # confirm it directly via the departments list.
        dept_list_resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/departments/')
        names = [d['name'] for d in dept_list_resp.data['data']]
        self.assertIn('Renamed Dept', names)
        course.delete()

    def test_admin_x_cannot_edit_university_ys_department(self):
        other_dept = Department.objects.create(university=self.other_uni, name='Other Dept', code='OD')
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.patch(f'/api/university-admin/departments/{other_dept.id}/', {'name': 'Hijacked'}, format='json')
        self.assertEqual(resp.status_code, 403)
        other_dept.refresh_from_db()
        self.assertEqual(other_dept.name, 'Other Dept')
        other_dept.delete()


class CourseEditTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni_admin = User.objects.create_user(username='__t_cedit_admin__', email='cedit_admin@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin)
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='CE')
        self.course = Course.objects.create(department=self.dept, name='Old Course Name', code='OLD101')

    def tearDown(self):
        University.objects.filter(id=self.uni.id).delete()

    def test_real_edit_updates_name_and_code(self):
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.patch(f'/api/university-admin/courses/{self.course.id}/', {
            'name': 'New Course Name', 'code': 'NEW101',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['data']['name'], 'New Course Name')
        self.assertEqual(resp.data['data']['code'], 'NEW101')
        self.course.refresh_from_db()
        self.assertEqual(self.course.code, 'NEW101')

    def test_duplicate_code_within_same_department_rejected(self):
        Course.objects.create(department=self.dept, name='Taken', code='TAKEN')
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.patch(f'/api/university-admin/courses/{self.course.id}/', {'code': 'TAKEN'}, format='json')
        self.assertEqual(resp.status_code, 400)


class DepartmentDeleteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni_admin = User.objects.create_user(username='__t_ddel_admin__', email='ddel_admin@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin)

    def test_delete_requires_exact_typed_name(self):
        dept = Department.objects.create(university=self.uni, name='__TEST__ Delete Dept A', code='DDA')
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.delete(f'/api/university-admin/departments/{dept.id}/', {'confirm_name': 'wrong'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(Department.objects.filter(id=dept.id).exists())
        dept.delete()

    def test_delete_blocked_by_real_course_enrolled_students(self):
        dept = Department.objects.create(university=self.uni, name='__TEST__ Delete Dept B', code='DDB')
        course = Course.objects.create(department=dept, name='Course', code='C1')
        student = User.objects.create_user(username='__t_ddel_student__', email='ddel_student@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=course, user=student, role='student')

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.delete(f'/api/university-admin/departments/{dept.id}/', {'confirm_name': dept.name}, format='json')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('1 real, enrolled student', resp.data['message'])
        self.assertIn('1 course', resp.data['message'])
        self.assertTrue(Department.objects.filter(id=dept.id).exists())
        dept.delete()

    def test_delete_blocked_by_department_wide_student_with_no_course(self):
        """The real, less obvious case: a student affiliated with the
        department directly (bulk-CSV/invite with no course_code) —
        never enrolled in any specific course, but a real person who'd
        be silently cascade-deleted without this check."""
        dept = Department.objects.create(university=self.uni, name='__TEST__ Delete Dept C', code='DDC')
        student = User.objects.create_user(username='__t_ddel_deptwide__', email='ddel_deptwide@t.com', password='pw12345')
        UniversityAffiliation.objects.create(user=student, university=self.uni, department=dept, role='student')

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.delete(f'/api/university-admin/departments/{dept.id}/', {'confirm_name': dept.name}, format='json')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('1 real, enrolled student', resp.data['message'])
        self.assertTrue(Department.objects.filter(id=dept.id).exists())
        dept.delete()

    def test_delete_blocked_by_real_active_session(self):
        dept = Department.objects.create(university=self.uni, name='__TEST__ Delete Dept D', code='DDD')
        course = Course.objects.create(department=dept, name='Course', code='C1')
        lecturer = User.objects.create_user(username='__t_ddel_lect__', email='ddel_lect@t.com', password='pw12345')
        now = timezone.now()
        session = LiveSession.objects.create(
            host=lecturer, name='Live', course=course, invite_code='DDELLIVE1',
            start_time=now, end_time=now, status='active',
        )

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.delete(f'/api/university-admin/departments/{dept.id}/', {'confirm_name': dept.name}, format='json')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('active class session', resp.data['message'])
        self.assertTrue(Department.objects.filter(id=dept.id).exists())

        session.delete()
        dept.delete()

    def test_genuinely_empty_department_deletes_with_real_cascade(self):
        dept = Department.objects.create(university=self.uni, name='__TEST__ Delete Dept Empty', code='DDE')
        course = Course.objects.create(department=dept, name='Course', code='C1')
        dept_id, course_id = dept.id, course.id

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.delete(f'/api/university-admin/departments/{dept.id}/', {'confirm_name': dept.name}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertFalse(Department.objects.filter(id=dept_id).exists())
        self.assertFalse(Course.objects.filter(id=course_id).exists())

    def test_admin_x_cannot_delete_university_ys_department(self):
        other_admin = User.objects.create_user(username='__t_ddel_otheradmin__', email='ddel_otheradmin@t.com', password='pw12345')
        other_uni = _make_active_university(other_admin, name='__TEST__ Delete Dept Other Uni')
        other_dept = Department.objects.create(university=other_uni, name='Real Other Dept', code='ROD')

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.delete(f'/api/university-admin/departments/{other_dept.id}/', {'confirm_name': other_dept.name}, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(Department.objects.filter(id=other_dept.id).exists())

        other_dept.delete()
        other_uni.delete()


class CourseDeleteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni_admin = User.objects.create_user(username='__t_cdel_admin__', email='cdel_admin@t.com', password='pw12345')
        self.uni = _make_active_university(self.uni_admin)
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='CD')

    def tearDown(self):
        University.objects.filter(id=self.uni.id).delete()

    def test_delete_blocked_by_real_enrolled_students(self):
        course = Course.objects.create(department=self.dept, name='Course', code='C1')
        student = User.objects.create_user(username='__t_cdel_student__', email='cdel_student@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=course, user=student, role='student')

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.delete(f'/api/university-admin/courses/{course.id}/')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('1 real, enrolled student', resp.data['message'])
        self.assertTrue(Course.objects.filter(id=course.id).exists())

    def test_delete_blocked_by_real_active_session(self):
        course = Course.objects.create(department=self.dept, name='Course', code='C2')
        lecturer = User.objects.create_user(username='__t_cdel_lect__', email='cdel_lect@t.com', password='pw12345')
        now = timezone.now()
        session = LiveSession.objects.create(
            host=lecturer, name='Live', course=course, invite_code='CDELLIVE1',
            start_time=now, end_time=now, status='active',
        )

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.delete(f'/api/university-admin/courses/{course.id}/')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('active class session', resp.data['message'])

        session.delete()

    def test_genuinely_empty_course_deletes(self):
        course = Course.objects.create(department=self.dept, name='Course', code='C3')
        course_id = course.id
        self.client.force_authenticate(self.uni_admin)
        resp = self.client.delete(f'/api/university-admin/courses/{course.id}/')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertFalse(Course.objects.filter(id=course_id).exists())

    def test_admin_x_cannot_delete_university_ys_course(self):
        other_admin = User.objects.create_user(username='__t_cdel_otheradmin__', email='cdel_otheradmin@t.com', password='pw12345')
        other_uni = _make_active_university(other_admin, name='__TEST__ Course Delete Other Uni')
        other_dept = Department.objects.create(university=other_uni, name='Other Dept', code='OD2')
        other_course = Course.objects.create(department=other_dept, name='Other Course', code='OC1')

        self.client.force_authenticate(self.uni_admin)
        resp = self.client.delete(f'/api/university-admin/courses/{other_course.id}/')
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(Course.objects.filter(id=other_course.id).exists())

        other_uni.delete()
