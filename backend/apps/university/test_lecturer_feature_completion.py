"""
Phase 4 (Product Depth Layer) — Lecturer Feature Completion: recurring
scheduling, real attendance/engagement (derived from existing
LiveSession/SessionParticipant/VirtualMachine data), scoped broadcast,
and student-facing coursework — all real, adversarial HTTP-level tests.
"""
import io

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.users.models import User
from apps.vms.models import VMTemplate, VirtualMachine
from apps.sessions.models import LiveSession, SessionParticipant
from .models import University, Department, Course, UniversityAffiliation, CourseEnrollment, DepartmentInvite


class RecurringScheduleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Sched Uni', contact_email='s@t.com', contact_name='S', status='active')
        self.dept = Department.objects.create(university=self.uni, name='CS', code='CS')
        self.course_a = Course.objects.create(department=self.dept, name='Course A', code='SCA101')
        self.course_b = Course.objects.create(department=self.dept, name='Course B', code='SCB101')
        self.lecturer = User.objects.create_user(username='__t_sched_lect__', email='sched_lect@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course_a, user=self.lecturer, role='lecturer')
        self.client.force_authenticate(self.lecturer)

    def test_lecturer_can_set_real_schedule_on_own_course(self):
        resp = self.client.patch(f'/api/university-admin/courses/{self.course_a.id}/', {
            'schedule_day': 'wednesday', 'schedule_time': '14:30',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['data']['schedule_day'], 'wednesday')
        self.assertEqual(resp.data['data']['schedule_time'], '14:30')
        self.course_a.refresh_from_db()
        self.assertEqual(self.course_a.schedule_day, 'wednesday')
        self.assertEqual(str(self.course_a.schedule_time), '14:30:00')

    def test_lecturer_cannot_set_schedule_on_course_they_dont_teach(self):
        resp = self.client.patch(f'/api/university-admin/courses/{self.course_b.id}/', {
            'schedule_day': 'friday', 'schedule_time': '09:00',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.course_b.refresh_from_db()
        self.assertIsNone(self.course_b.schedule_day)

    def test_invalid_schedule_day_rejected(self):
        resp = self.client.patch(f'/api/university-admin/courses/{self.course_a.id}/', {
            'schedule_day': 'someday',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_invalid_schedule_time_format_rejected(self):
        resp = self.client.patch(f'/api/university-admin/courses/{self.course_a.id}/', {
            'schedule_time': 'not-a-time',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_clearing_schedule_with_empty_string_works(self):
        self.course_a.schedule_day = 'monday'
        self.course_a.save()
        resp = self.client.patch(f'/api/university-admin/courses/{self.course_a.id}/', {
            'schedule_day': '',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.course_a.refresh_from_db()
        self.assertIsNone(self.course_a.schedule_day)

    def test_schedule_visible_on_my_courses(self):
        self.course_a.schedule_day = 'tuesday'
        self.course_a.save()
        resp = self.client.get('/api/university-admin/lecturer/my-courses/')
        self.assertEqual(resp.data['data'][0]['schedule_day'], 'tuesday')


class RealAttendanceEngagementTests(TestCase):
    """Real duration derived from VirtualMachine.started_at/stopped_at —
    the existing, proven VM lifecycle timestamps, no new tracking."""

    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Attend Uni', contact_email='a@t.com', contact_name='A', status='active')
        self.dept = Department.objects.create(university=self.uni, name='CS', code='CS')
        self.course = Course.objects.create(department=self.dept, name='Networks', code='ATT201')
        self.template = VMTemplate.objects.create(
            name='__TEST__ Attend Template', description='x', cpu_cores=1, ram_gb=1, storage_gb=5, os='Linux',
        )
        self.lecturer = User.objects.create_user(username='__t_att_lect__', email='att_lect@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course, user=self.lecturer, role='lecturer')
        self.student = User.objects.create_user(username='__t_att_student__', email='att_student@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course, user=self.student, role='student')

        now = timezone.now()
        self.session1 = LiveSession.objects.create(
            host=self.lecturer, name='__TEST__ Session 1', course=self.course, required_vm_template=self.template,
            invite_code='ATTS0001', start_time=now, end_time=now, status='ended',
        )
        self.session2 = LiveSession.objects.create(
            host=self.lecturer, name='__TEST__ Session 2', course=self.course, required_vm_template=self.template,
            invite_code='ATTS0002', start_time=now, end_time=now, status='ended',
        )

        # Real, 30-minute session: VM started, ran, stopped.
        vm1 = VirtualMachine.objects.create(
            name='vm1', owner=self.student, template=self.template, status='stopped',
            started_at=now - timezone.timedelta(minutes=30), stopped_at=now,
        )
        SessionParticipant.objects.create(session=self.session1, user=self.student, vm=vm1, status='disconnected')

        # Real, 10-minute session.
        vm2 = VirtualMachine.objects.create(
            name='vm2', owner=self.student, template=self.template, status='stopped',
            started_at=now - timezone.timedelta(minutes=10), stopped_at=now,
        )
        SessionParticipant.objects.create(session=self.session2, user=self.student, vm=vm2, status='disconnected')

        self.client.force_authenticate(self.lecturer)

    def test_roster_shows_real_average_and_total_duration(self):
        resp = self.client.get(f'/api/university-admin/lecturer/courses/{self.course.id}/roster/')
        self.assertEqual(resp.status_code, 200)
        student_row = next(r for r in resp.data['data']['roster'] if r['user_id'] == self.student.id)
        self.assertEqual(student_row['sessions_attended'], 2)
        # (30 + 10) / 2 = 20 minutes average
        self.assertAlmostEqual(student_row['average_duration_minutes'], 20.0, delta=0.5)
        self.assertAlmostEqual(student_row['total_minutes'], 40.0, delta=0.5)

    def test_per_session_average_duration_present(self):
        resp = self.client.get(f'/api/university-admin/lecturer/courses/{self.course.id}/roster/')
        session1_row = next(s for s in resp.data['data']['sessions'] if s['id'] == self.session1.id)
        self.assertAlmostEqual(session1_row['average_duration_minutes'], 30.0, delta=0.5)

    def test_never_joined_participant_shows_zero_not_error(self):
        never_joined = User.objects.create_user(username='__t_never_joined__', email='never_joined@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course, user=never_joined, role='student')
        resp = self.client.get(f'/api/university-admin/lecturer/courses/{self.course.id}/roster/')
        self.assertEqual(resp.status_code, 200)
        row = next(r for r in resp.data['data']['roster'] if r['user_id'] == never_joined.id)
        self.assertEqual(row['sessions_attended'], 0)
        self.assertEqual(row['average_duration_minutes'], 0)


class ScopedBroadcastTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Broadcast Uni', contact_email='b@t.com', contact_name='B', status='active')
        self.dept = Department.objects.create(university=self.uni, name='CS', code='CS')
        self.course_a = Course.objects.create(department=self.dept, name='Course A', code='BCA101')
        self.course_b = Course.objects.create(department=self.dept, name='Course B', code='BCB101')

        self.lecturer = User.objects.create_user(username='__t_bcast_lect__', email='bcast_lect@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course_a, user=self.lecturer, role='lecturer')

        self.student1 = User.objects.create_user(username='__t_bcast_s1__', email='bcast_s1@t.com', password='pw12345')
        self.student2 = User.objects.create_user(username='__t_bcast_s2__', email='bcast_s2@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course_a, user=self.student1, role='student')
        CourseEnrollment.objects.create(course=self.course_a, user=self.student2, role='student')

        # A co-lecturer on the same course must NOT receive the broadcast
        # (only real students do).
        self.co_lecturer = User.objects.create_user(username='__t_bcast_colect__', email='bcast_colect@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course_a, user=self.co_lecturer, role='lecturer')

        # A student in a DIFFERENT course must never receive it.
        self.other_student = User.objects.create_user(username='__t_bcast_other__', email='bcast_other@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course_b, user=self.other_student, role='student')

        self.client.force_authenticate(self.lecturer)

    def test_broadcast_reaches_real_roster_no_live_session_required(self):
        """The explicit ask: works with zero active LiveSession."""
        self.assertEqual(LiveSession.objects.filter(course=self.course_a).count(), 0)
        resp = self.client.post(f'/api/university-admin/lecturer/courses/{self.course_a.id}/broadcast/', {
            'message': 'Real class moved to Room 204 this week.',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIn('2', resp.data['message'])

        self.assertTrue(Notification.objects.filter(user=self.student1, message__icontains='Room 204').exists())
        self.assertTrue(Notification.objects.filter(user=self.student2, message__icontains='Room 204').exists())

    def test_broadcast_never_reaches_other_course_students(self):
        self.client.post(f'/api/university-admin/lecturer/courses/{self.course_a.id}/broadcast/', {
            'message': 'Course A only message.',
        }, format='json')
        self.assertFalse(Notification.objects.filter(user=self.other_student, message__icontains='Course A only').exists())

    def test_broadcast_never_reaches_co_lecturer(self):
        self.client.post(f'/api/university-admin/lecturer/courses/{self.course_a.id}/broadcast/', {
            'message': 'Students only message.',
        }, format='json')
        self.assertFalse(Notification.objects.filter(user=self.co_lecturer, message__icontains='Students only').exists())

    def test_lecturer_cannot_broadcast_to_course_they_dont_teach(self):
        resp = self.client.post(f'/api/university-admin/lecturer/courses/{self.course_b.id}/broadcast/', {
            'message': 'Injected message',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(Notification.objects.filter(message__icontains='Injected message').exists())

    def test_empty_message_rejected(self):
        resp = self.client.post(f'/api/university-admin/lecturer/courses/{self.course_a.id}/broadcast/', {
            'message': '   ',
        }, format='json')
        self.assertEqual(resp.status_code, 400)


class StudentCourseworkEnrollmentPathTests(TestCase):
    """THE explicit ask: recurring scheduled classes (and attendance)
    must correctly appear for students regardless of HOW they were
    enrolled — bulk CSV vs self-enroll invite link — not just whichever
    path is most convenient to test with. Both real endpoints exercised
    here, not simulated."""

    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Enroll Path Uni', contact_email='e@t.com', contact_name='E', status='active')
        self.admin = User.objects.create_user(username='__t_enroll_admin__', email='enroll_admin@t.com', password='pw12345')
        self.uni.admin_user = self.admin
        self.uni.save()
        self.dept = Department.objects.create(university=self.uni, name='Math', code='MTH')
        self.course = Course.objects.create(
            department=self.dept, name='Calculus II', code='MTH202',
            schedule_day='monday', schedule_time='10:00',
        )

    def test_bulk_csv_enrolled_student_sees_real_schedule_and_starts_at_zero_attendance(self):
        csv_student = User.objects.create_user(username='__t_csv_student__', email='csv_student@t.com', password='pw12345')
        self.client.force_authenticate(self.admin)

        csv_content = f'email,department_code,role,course_code\n{csv_student.email},MTH,student,MTH202\n'
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'enroll.csv'
        upload_resp = self.client.post(
            f'/api/university-admin/universities/{self.uni.id}/enroll/bulk-csv/',
            {'file': csv_file}, format='multipart',
        )
        self.assertEqual(upload_resp.status_code, 200)
        self.assertEqual(upload_resp.data['data']['ok'], 1)

        self.client.force_authenticate(csv_student)
        resp = self.client.get('/api/university-admin/student/my-coursework/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['data']), 1)
        course_row = resp.data['data'][0]
        self.assertEqual(course_row['code'], 'MTH202')
        self.assertEqual(course_row['schedule_day'], 'monday')
        self.assertEqual(course_row['schedule_time'], '10:00')
        self.assertEqual(course_row['sessions_attended'], 0)

    def test_self_enroll_invite_student_sees_the_identical_real_schedule(self):
        invite_student = User.objects.create_user(username='__t_invite_student__', email='invite_student@t.com', password='pw12345')
        invite = DepartmentInvite.objects.create(
            department=self.dept, course=self.course, role='student', code='REALCOURSEINV1', created_by=self.admin,
        )

        self.client.force_authenticate(invite_student)
        redeem_resp = self.client.post('/api/university-admin/invites/redeem/', {'code': invite.code}, format='json')
        self.assertEqual(redeem_resp.status_code, 200, redeem_resp.data)

        resp = self.client.get('/api/university-admin/student/my-coursework/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['data']), 1)
        course_row = resp.data['data'][0]
        self.assertEqual(course_row['code'], 'MTH202')
        self.assertEqual(course_row['schedule_day'], 'monday')
        self.assertEqual(course_row['schedule_time'], '10:00')

    def test_both_enrollment_paths_converge_on_the_identical_real_schedule_data(self):
        """Not just 'both work independently' — both paths produce the
        EXACT same schedule payload for the same real course, proving
        MyCourseworkView reads one real source of truth regardless of
        how the CourseEnrollment row was created."""
        csv_student = User.objects.create_user(username='__t_conv_csv__', email='conv_csv@t.com', password='pw12345')
        invite_student = User.objects.create_user(username='__t_conv_invite__', email='conv_invite@t.com', password='pw12345')

        self.client.force_authenticate(self.admin)
        csv_content = f'email,department_code,role,course_code\n{csv_student.email},MTH,student,MTH202\n'
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'enroll.csv'
        self.client.post(
            f'/api/university-admin/universities/{self.uni.id}/enroll/bulk-csv/',
            {'file': csv_file}, format='multipart',
        )
        invite = DepartmentInvite.objects.create(
            department=self.dept, course=self.course, role='student', code='REALCOURSEINV2', created_by=self.admin,
        )
        self.client.force_authenticate(invite_student)
        self.client.post('/api/university-admin/invites/redeem/', {'code': invite.code}, format='json')

        self.client.force_authenticate(csv_student)
        csv_view = self.client.get('/api/university-admin/student/my-coursework/').data['data'][0]
        self.client.force_authenticate(invite_student)
        invite_view = self.client.get('/api/university-admin/student/my-coursework/').data['data'][0]

        self.assertEqual(csv_view['schedule_day'], invite_view['schedule_day'])
        self.assertEqual(csv_view['schedule_time'], invite_view['schedule_time'])
        self.assertEqual(csv_view['code'], invite_view['code'])

    def test_student_coursework_never_shows_a_course_they_are_not_enrolled_in(self):
        other_course = Course.objects.create(department=self.dept, name='Physics I', code='MTH999', schedule_day='friday')
        outsider = User.objects.create_user(username='__t_coursework_outsider__', email='coursework_outsider@t.com', password='pw12345')
        self.client.force_authenticate(outsider)
        resp = self.client.get('/api/university-admin/student/my-coursework/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data'], [])
