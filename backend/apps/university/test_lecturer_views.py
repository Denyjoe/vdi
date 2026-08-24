"""
Phase 5 — real, adversarial HTTP-level tests for the Lecturer Dashboard.

Specifically proves, over the real wired-up URLs:
  1. A lecturer for Course A cannot start or see sessions for Course B,
     even within the SAME department.
  2. "Start Class Session" genuinely reuses the existing
     PayAndStartSessionView/LiveSession system — the resulting session is
     a real row in the SAME table already read by the proven
     AdminLiveSessionsView (Live Sessions Monitor) and LiveSessionListView
     ("My Sessions" / hosted+joined) — not a parallel course-session model.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.vms.models import VMTemplate
from apps.sessions.models import LiveSession, SessionParticipant
from .models import University, Department, Course, CourseEnrollment


class LecturerCourseBoundaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Lecturer Boundary Uni', contact_email='l@t.com', contact_name='L', status='active')
        self.dept = Department.objects.create(university=self.uni, name='CS', code='CS')
        self.course_a = Course.objects.create(department=self.dept, name='Course A', code='A101')
        self.course_b = Course.objects.create(department=self.dept, name='Course B', code='B101')

        self.lecturer_a = User.objects.create_user(username='__t_lect_a__', email='lect_a@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course_a, user=self.lecturer_a, role='lecturer')

        self.template = VMTemplate.objects.create(
            name='__TEST__ Template', description='x', cpu_cores=1, ram_gb=1, storage_gb=5, os='Linux',
            price_per_hour=0,
        )
        self.client.force_authenticate(self.lecturer_a)

    def test_my_courses_lists_only_course_a(self):
        resp = self.client.get('/api/university-admin/lecturer/my-courses/')
        self.assertEqual(resp.status_code, 200)
        codes = [c['code'] for c in resp.data['data']]
        self.assertIn('A101', codes)
        self.assertNotIn('B101', codes)

    def test_lecturer_a_cannot_view_roster_for_course_b(self):
        resp = self.client.get(f'/api/university-admin/lecturer/courses/{self.course_b.id}/roster/')
        self.assertEqual(resp.status_code, 403)
        self.assertNotIn('data', resp.data)

    def test_lecturer_a_can_view_roster_for_course_a(self):
        """Positive control."""
        resp = self.client.get(f'/api/university-admin/lecturer/courses/{self.course_a.id}/roster/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data']['course']['code'], 'A101')

    def test_lecturer_a_cannot_start_class_session_for_course_b(self):
        """The real, attempted cross-course session start — even though
        both courses are in the SAME department."""
        before_count = LiveSession.objects.filter(course=self.course_b).count()
        resp = self.client.post('/api/sessions/live/pay-and-start/', {
            'name': 'Injected Session', 'vm_template': self.template.id,
            'hours': 1, 'course_id': self.course_b.id,
            'provider': 'mpesa', 'phone_number': '0700000000',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(LiveSession.objects.filter(course=self.course_b).count(), before_count)

    def test_lecturer_a_can_start_class_session_for_course_a(self):
        """Positive control — the real, legitimate flow."""
        resp = self.client.post('/api/sessions/live/pay-and-start/', {
            'name': 'Course A Real Class', 'vm_template': self.template.id,
            'hours': 1, 'course_id': self.course_a.id,
            'provider': 'mpesa', 'phone_number': '0700000000',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        session = LiveSession.objects.get(id=resp.data['data']['id'])
        self.assertEqual(session.course_id, self.course_a.id)
        self.assertEqual(session.host_id, self.lecturer_a.id)
        session.delete()

    def test_student_enrolled_in_course_a_cannot_view_roster(self):
        student = User.objects.create_user(username='__t_stu_a__', email='stu_a@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course_a, user=student, role='student')
        self.client.force_authenticate(student)
        resp = self.client.get(f'/api/university-admin/lecturer/courses/{self.course_a.id}/roster/')
        self.assertEqual(resp.status_code, 403)


class RealSessionSystemReuseTests(TestCase):
    """The specific proof requested: a session started via 'Start Class
    Session' is a REAL row in the SAME LiveSession table already read by
    the proven Live-Sessions-Monitor and My-Sessions endpoints — not a
    parallel table — AND is correctly reflected in the new course-scoped
    roster at the same time."""

    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Reuse Uni', contact_email='r@t.com', contact_name='R', status='active')
        self.dept = Department.objects.create(university=self.uni, name='Math', code='MTH')
        self.course = Course.objects.create(department=self.dept, name='Calculus', code='MTH101')
        self.lecturer = User.objects.create_user(username='__t_reuse_lect__', email='reuse_lect@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course, user=self.lecturer, role='lecturer')
        self.student = User.objects.create_user(username='__t_reuse_stu__', email='reuse_stu@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course, user=self.student, role='student')

        self.template = VMTemplate.objects.create(
            name='__TEST__ Reuse Template', description='x', cpu_cores=1, ram_gb=1, storage_gb=5,
            os='Linux', price_per_hour=0,
        )

        self.platform_admin = User.objects.create_user(
            username='__t_reuse_platadmin__', email='reuse_platadmin@t.com', password='pw12345', role='admin')

    def test_class_session_appears_in_monitor_my_sessions_and_roster_simultaneously(self):
        self.client.force_authenticate(self.lecturer)
        start_resp = self.client.post('/api/sessions/live/pay-and-start/', {
            'name': 'Live Calculus Lecture', 'vm_template': self.template.id,
            'hours': 1, 'course_id': self.course.id,
            'provider': 'mpesa', 'phone_number': '0700000000',
        }, format='json')
        self.assertEqual(start_resp.status_code, 200, start_resp.data)
        session_id = start_resp.data['data']['id']
        self.assertEqual(start_resp.data['data']['course_id'], self.course.id)

        # 1. The EXISTING, proven "Live Sessions Monitor" (admin) — no
        # code change was needed there; it just reads LiveSession.
        self.client.force_authenticate(self.platform_admin)
        monitor_resp = self.client.get('/api/sessions/admin/live/')
        self.assertEqual(monitor_resp.status_code, 200)
        monitor_ids = [s['id'] for s in monitor_resp.data['sessions']]
        self.assertIn(session_id, monitor_ids)

        # 2. The EXISTING, proven "My Sessions" (host) view.
        self.client.force_authenticate(self.lecturer)
        my_sessions_resp = self.client.get('/api/sessions/live/')
        self.assertEqual(my_sessions_resp.status_code, 200)
        hosted_ids = [s['id'] for s in my_sessions_resp.data['data']['my_hosted']]
        self.assertIn(session_id, hosted_ids)

        # 3. A real student joins via the EXISTING join-by-code flow.
        session = LiveSession.objects.get(id=session_id)
        self.client.force_authenticate(self.student)
        join_resp = self.client.post('/api/sessions/live/join/', {
            'invite_code': session.invite_code,
        }, format='json')
        self.assertEqual(join_resp.status_code, 200, join_resp.data)

        # 4. The student's own "My Sessions" (joined) reflects it too.
        joined_resp = self.client.get('/api/sessions/live/')
        joined_ids = [s['id'] for s in joined_resp.data['data']['joined']]
        self.assertIn(session_id, joined_ids)

        # 5. The NEW course-scoped roster reflects the exact same real
        # session and the real join — proving both views are reading the
        # identical underlying data, not two disconnected systems.
        self.client.force_authenticate(self.lecturer)
        roster_resp = self.client.get(f'/api/university-admin/lecturer/courses/{self.course.id}/roster/')
        self.assertEqual(roster_resp.status_code, 200)
        roster_data = roster_resp.data['data']
        session_ids_in_roster = [s['id'] for s in roster_data['sessions']]
        self.assertIn(session_id, session_ids_in_roster)
        matched_session = next(s for s in roster_data['sessions'] if s['id'] == session_id)
        self.assertEqual(matched_session['participant_count'], 1)

        student_row = next(r for r in roster_data['roster'] if r['user_id'] == self.student.id)
        self.assertEqual(student_row['sessions_attended'], 1)

        session.delete()
