"""
Phase 2 (Premium Rebuild) — Session Management, Properly Surfaced.

MyCoursesView now reports a real, live active_session per course
(status='active', hosted by this exact lecturer) so the Lecturer
Dashboard can surface the full, existing session-hosting toolkit right
on the course card the moment a class session is genuinely running —
reusing the SAME LiveSession model/endpoints HostSessionPage already
uses, not a parallel tracking system.
"""
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.university.models import University, Department, Course, CourseEnrollment
from apps.sessions.models import LiveSession


class ActiveSessionSurfacingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Active Session Uni', contact_email='c@t.com', contact_name='C', status='active')
        self.dept = Department.objects.create(university=self.uni, name='Dept', code='AS')
        self.course = Course.objects.create(department=self.dept, name='Course', code='ASV101')
        self.lecturer = User.objects.create_user(username='__t_asv_lect__', email='asv_lect@t.com', password='pw12345')
        self.other_lecturer = User.objects.create_user(username='__t_asv_other__', email='asv_other@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course, user=self.lecturer, role='lecturer')
        CourseEnrollment.objects.create(course=self.course, user=self.other_lecturer, role='lecturer')

    def test_no_active_session_reports_null(self):
        self.client.force_authenticate(self.lecturer)
        resp = self.client.get('/api/university-admin/lecturer/my-courses/')
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.data['data'][0]['active_session'])

    def test_real_active_session_hosted_by_this_lecturer_is_surfaced(self):
        now = timezone.now()
        session = LiveSession.objects.create(
            host=self.lecturer, name='__TEST__ Real Class', course=self.course,
            invite_code='ASVLIVE1', start_time=now, end_time=now,
            scheduled_end_at=now + timezone.timedelta(hours=2),
            status='active', restrict_internet=True, is_exam_mode=False,
        )

        self.client.force_authenticate(self.lecturer)
        resp = self.client.get('/api/university-admin/lecturer/my-courses/')
        active = resp.data['data'][0]['active_session']
        self.assertIsNotNone(active)
        self.assertEqual(active['id'], session.id)
        self.assertEqual(active['name'], '__TEST__ Real Class')
        self.assertTrue(active['restrict_internet'])
        self.assertEqual(active['participant_count'], 0)

        session.delete()

    def test_ended_session_is_not_reported_as_active(self):
        now = timezone.now()
        LiveSession.objects.create(
            host=self.lecturer, name='__TEST__ Old Class', course=self.course,
            invite_code='ASVOLD01', start_time=now, end_time=now, status='ended',
        )
        self.client.force_authenticate(self.lecturer)
        resp = self.client.get('/api/university-admin/lecturer/my-courses/')
        self.assertIsNone(resp.data['data'][0]['active_session'])

    def test_another_lecturers_active_session_on_the_same_course_is_not_leaked(self):
        """Two real co-lecturers of the same course, each hosting their
        own real session — never cross-shown."""
        now = timezone.now()
        other_session = LiveSession.objects.create(
            host=self.other_lecturer, name='__TEST__ Other Host Session', course=self.course,
            invite_code='ASVOTH01', start_time=now, end_time=now, status='active',
        )

        self.client.force_authenticate(self.lecturer)
        resp = self.client.get('/api/university-admin/lecturer/my-courses/')
        self.assertIsNone(resp.data['data'][0]['active_session'])

        self.client.force_authenticate(self.other_lecturer)
        resp2 = self.client.get('/api/university-admin/lecturer/my-courses/')
        self.assertIsNotNone(resp2.data['data'][0]['active_session'])
        self.assertEqual(resp2.data['data'][0]['active_session']['id'], other_session.id)

        other_session.delete()

    def test_real_monitor_endpoint_is_reachable_by_the_host_lecturer(self):
        """The exact real endpoint ActiveSessionPanel polls — proves the
        host boundary (session.host == request.user) already enforced by
        SessionMonitorView works correctly for this real course-tied
        session, same as any other real session."""
        now = timezone.now()
        session = LiveSession.objects.create(
            host=self.lecturer, name='__TEST__ Monitor Class', course=self.course,
            invite_code='ASVMON01', start_time=now, end_time=now, status='active',
        )

        self.client.force_authenticate(self.lecturer)
        monitor_resp = self.client.get(f'/api/sessions/live/{session.id}/monitor/')
        self.assertEqual(monitor_resp.status_code, 200)

        self.client.force_authenticate(self.other_lecturer)
        blocked_resp = self.client.get(f'/api/sessions/live/{session.id}/monitor/')
        self.assertEqual(blocked_resp.status_code, 403)

        session.delete()
