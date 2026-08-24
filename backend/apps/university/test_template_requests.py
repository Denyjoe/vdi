"""
Phase 2 (Product Depth Layer) — real, adversarial tests for the Template
Request Workflow: lecturer submission, quota pre-check warning,
university admin review queue, approve/reject, and the wizard's real
quota enforcement + university-admin access widening.
"""
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.users.models import User
from apps.vms.models import DesktopEnvironmentProfile, TemplateCreationJob, VMTemplate
from .models import University, Department, Course, CourseEnrollment, TemplateRequest
from .permissions import can_access_template_job


class LecturerSubmissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ TR Uni', contact_email='tr@t.com', contact_name='T', status='active',
            max_vcpu_cores=8, max_ram_gb=16, max_storage_gb=200,
        )
        self.dept = Department.objects.create(university=self.uni, name='CS', code='CS')
        self.course_a = Course.objects.create(department=self.dept, name='Course A', code='TRA101')
        self.course_b = Course.objects.create(department=self.dept, name='Course B', code='TRB101')

        self.lecturer = User.objects.create_user(username='__t_tr_lect__', email='tr_lect@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course_a, user=self.lecturer, role='lecturer')
        self.client.force_authenticate(self.lecturer)

    def test_lecturer_can_submit_for_own_course(self):
        resp = self.client.post('/api/university-admin/lecturer/template-requests/', {
            'course_id': self.course_a.id, 'software_needed': 'MATLAB, Simulink',
            'purpose': 'Control systems lab', 'estimated_vcpu': 4,
            'estimated_ram_gb': 8, 'estimated_storage_gb': 60,
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data['data']['status'], 'pending')
        self.assertTrue(TemplateRequest.objects.filter(course=self.course_a, requested_by=self.lecturer).exists())

    def test_lecturer_cannot_submit_for_course_they_dont_teach(self):
        """The real, attempted cross-course boundary."""
        before = TemplateRequest.objects.filter(course=self.course_b).count()
        resp = self.client.post('/api/university-admin/lecturer/template-requests/', {
            'course_id': self.course_b.id, 'software_needed': 'X', 'purpose': 'Y',
            'estimated_vcpu': 1, 'estimated_ram_gb': 1, 'estimated_storage_gb': 1,
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(TemplateRequest.objects.filter(course=self.course_b).count(), before)

    def test_lecturer_only_sees_their_own_requests(self):
        other_lecturer = User.objects.create_user(username='__t_tr_other_lect__', email='tr_other_lect@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course_a, user=other_lecturer, role='lecturer')
        TemplateRequest.objects.create(
            course=self.course_a, requested_by=other_lecturer, software_needed='X', purpose='Y',
            estimated_vcpu=1, estimated_ram_gb=1, estimated_storage_gb=1,
        )
        TemplateRequest.objects.create(
            course=self.course_a, requested_by=self.lecturer, software_needed='Mine', purpose='Y',
            estimated_vcpu=1, estimated_ram_gb=1, estimated_storage_gb=1,
        )
        resp = self.client.get('/api/university-admin/lecturer/template-requests/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['data']), 1)
        self.assertEqual(resp.data['data'][0]['software_needed'], 'Mine')

    def test_quota_preview_warns_but_never_blocks_submission(self):
        """Real, honest pre-check — reports fits_quota accurately, but is
        a completely separate call from the actual POST (never blocks
        submission itself)."""
        # Fill almost the whole quota with an existing template.
        VMTemplate.objects.create(
            name='__TEST__ TR Filler', description='x', cpu_cores=7, ram_gb=15, storage_gb=190,
            os='Linux', university=self.uni,
        )
        resp = self.client.get('/api/university-admin/lecturer/template-requests/quota-preview/', {
            'course_id': self.course_a.id, 'estimated_vcpu': 4, 'estimated_ram_gb': 4, 'estimated_storage_gb': 20,
        })
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data['data']['fits_quota'])
        self.assertIn('vCPU', resp.data['data']['message'])

        # Submission still succeeds despite the warning — a real request
        # can be filed even if it doesn't currently fit.
        submit_resp = self.client.post('/api/university-admin/lecturer/template-requests/', {
            'course_id': self.course_a.id, 'software_needed': 'X', 'purpose': 'Y',
            'estimated_vcpu': 4, 'estimated_ram_gb': 4, 'estimated_storage_gb': 20,
        }, format='json')
        self.assertEqual(submit_resp.status_code, 201)


class UniversityAdminReviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni_x = University.objects.create(
            name='__TEST__ TR Uni X', contact_email='x@t.com', contact_name='X', status='active',
            max_vcpu_cores=8, max_ram_gb=16, max_storage_gb=200,
        )
        self.dept_x = Department.objects.create(university=self.uni_x, name='CS', code='CS')
        self.course_x = Course.objects.create(department=self.dept_x, name='Course X', code='TRX101')

        self.uni_y = University.objects.create(
            name='__TEST__ TR Uni Y', contact_email='y@t.com', contact_name='Y', status='active',
            max_vcpu_cores=8, max_ram_gb=16, max_storage_gb=200,
        )
        self.dept_y = Department.objects.create(university=self.uni_y, name='CS', code='CS')
        self.course_y = Course.objects.create(department=self.dept_y, name='Course Y', code='TRY101')

        self.admin_x = User.objects.create_user(username='__t_tr_admin_x__', email='tr_admin_x@t.com', password='pw12345')
        self.uni_x.admin_user = self.admin_x
        self.uni_x.save()

        self.lecturer_x = User.objects.create_user(username='__t_tr_lect_x__', email='tr_lect_x@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course_x, user=self.lecturer_x, role='lecturer')

        self.req_x = TemplateRequest.objects.create(
            course=self.course_x, requested_by=self.lecturer_x, software_needed='X', purpose='Y',
            estimated_vcpu=2, estimated_ram_gb=4, estimated_storage_gb=20,
        )
        self.req_y = TemplateRequest.objects.create(
            course=self.course_y, requested_by=self.lecturer_x, software_needed='X', purpose='Y',
            estimated_vcpu=2, estimated_ram_gb=4, estimated_storage_gb=20,
        )
        self.client.force_authenticate(self.admin_x)

    def test_admin_x_sees_only_university_x_requests(self):
        resp = self.client.get(f'/api/university-admin/universities/{self.uni_x.id}/template-requests/')
        self.assertEqual(resp.status_code, 200)
        ids = [r['id'] for r in resp.data['data']]
        self.assertIn(self.req_x.id, ids)
        self.assertNotIn(self.req_y.id, ids)

    def test_crafted_request_for_university_y_queue_is_blocked(self):
        resp = self.client.get(f'/api/university-admin/universities/{self.uni_y.id}/template-requests/')
        self.assertEqual(resp.status_code, 403)
        self.assertNotIn('data', resp.data)

    def test_admin_x_cannot_approve_university_ys_request(self):
        resp = self.client.post(f'/api/university-admin/template-requests/{self.req_y.id}/approve/')
        self.assertEqual(resp.status_code, 403)
        self.req_y.refresh_from_db()
        self.assertEqual(self.req_y.status, 'pending')

    def test_admin_x_can_approve_own_universitys_request_with_real_quota_check(self):
        resp = self.client.post(f'/api/university-admin/template-requests/{self.req_x.id}/approve/')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['data']['status'], 'approved')
        self.assertTrue(resp.data['quota_check']['fits_quota'])
        self.req_x.refresh_from_db()
        self.assertEqual(self.req_x.status, 'approved')
        self.assertIsNotNone(self.req_x.reviewed_at)

    def test_approve_returns_honest_quota_warning_when_it_wont_fit(self):
        """The exact scenario requested: estimated specs exceed remaining
        quota - the admin must see a real, honest warning at approval
        time, before ever entering the wizard."""
        VMTemplate.objects.create(
            name='__TEST__ TR Almost Full', description='x', cpu_cores=7, ram_gb=4, storage_gb=20,
            os='Linux', university=self.uni_x,
        )
        resp = self.client.post(f'/api/university-admin/template-requests/{self.req_x.id}/approve/')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data['quota_check']['fits_quota'])
        self.assertIn('vCPU', resp.data['quota_check']['message'])
        # Approval itself still succeeds (a real negotiation may resolve
        # the shortfall before building) - only the actual BUILD is
        # hard-blocked, tested below.
        self.req_x.refresh_from_db()
        self.assertEqual(self.req_x.status, 'approved')

    def test_reject_requires_real_reason_and_notifies_lecturer(self):
        resp = self.client.post(f'/api/university-admin/template-requests/{self.req_x.id}/reject/', {
            'reason': 'Software already available in the SciComp template.',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.req_x.refresh_from_db()
        self.assertEqual(self.req_x.status, 'rejected')
        self.assertEqual(self.req_x.admin_notes, 'Software already available in the SciComp template.')

        notif = Notification.objects.filter(
            user=self.lecturer_x, notification_type='template_request_rejected',
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn('TRX101', notif.message)

    def test_reject_without_reason_is_rejected(self):
        resp = self.client.post(f'/api/university-admin/template-requests/{self.req_x.id}/reject/', {}, format='json')
        self.assertEqual(resp.status_code, 400)


class WizardQuotaAndAccessTests(TestCase):
    """The Phase 1 addendum: the wizard's real create-job endpoint must
    respect the SAME quota enforcement, rejecting BEFORE any real
    Proxmox VM is created - never a silent failure partway through."""

    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Wizard Quota Uni', contact_email='w@t.com', contact_name='W', status='active',
            max_vcpu_cores=4, max_ram_gb=8, max_storage_gb=100,
        )
        self.dept = Department.objects.create(university=self.uni, name='CS', code='CS')
        self.course = Course.objects.create(department=self.dept, name='Wizard Course', code='WZ101')
        self.admin = User.objects.create_user(username='__t_wz_admin__', email='wz_admin@t.com', password='pw12345')
        self.uni.admin_user = self.admin
        self.uni.save()

        self.de_profile = DesktopEnvironmentProfile.objects.filter(name='gnome').first() \
            or DesktopEnvironmentProfile.objects.first()

        self.approved_req = TemplateRequest.objects.create(
            course=self.course, requested_by=self.admin, software_needed='X', purpose='Y',
            estimated_vcpu=2, estimated_ram_gb=4, estimated_storage_gb=20,
            status='approved', reviewed_at=timezone.now(),
        )
        self.client.force_authenticate(self.admin)

    def test_university_admin_cannot_start_unscoped_platform_job(self):
        """No template_request_id at all — must be rejected, even for a
        real university admin, since this endpoint also serves platform-
        wide, unscoped builds."""
        resp = self.client.post('/api/admin/templates/create-job/', {
            'name': 'Rogue Template', 'cpu_cores': 1, 'ram_gb': 1, 'disk_gb': 5,
            'iso_volid': 'local:iso/fake.iso', 'desktop_environment_id': self.de_profile.id if self.de_profile else 1,
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_free_text_request_name_is_sanitized_to_a_valid_proxmox_vm_name(self):
        """Real bug found live: a name auto-generated from a lecturer's
        free-text request ('COURSE — software, needed') genuinely 502'd
        against real Proxmox ('does not look like a valid DNS name').
        The real Proxmox object now gets a sanitized slug; only that
        call's `name` argument needs to be DNS-safe."""
        from unittest.mock import patch

        with patch('apps.vms.services.proxmox_service.ProxmoxService.create_vm', return_value=9999) as mock_create, \
             patch('apps.vms.services.proxmox_service.ProxmoxService.start_vm', return_value=None):
            resp = self.client.post('/api/admin/templates/create-job/', {
                'name': 'ENG401 — ROS, Gazebo Simulator!!', 'cpu_cores': 1, 'ram_gb': 1, 'disk_gb': 5,
                'iso_volid': 'local:iso/fake.iso', 'desktop_environment_id': self.de_profile.id if self.de_profile else 1,
                'template_request_id': self.approved_req.id,
            }, format='json')

        self.assertEqual(resp.status_code, 201, resp.data)
        mock_create.assert_called_once()
        called_name = mock_create.call_args[0][0]
        self.assertRegex(called_name, r'^[a-z0-9-]+$')
        self.assertNotIn(' ', called_name)
        self.assertNotIn('—', called_name)
        # The real, human-readable name is preserved on the job itself.
        job = TemplateCreationJob.objects.get(template_request=self.approved_req)
        self.assertEqual(job.name, 'ENG401 — ROS, Gazebo Simulator!!')
        job.delete()

    def test_university_admin_cannot_build_from_another_universitys_request(self):
        other_uni = University.objects.create(
            name='__TEST__ Wizard Other Uni', contact_email='wo@t.com', contact_name='WO', status='active',
            max_vcpu_cores=4, max_ram_gb=8, max_storage_gb=100,
        )
        other_dept = Department.objects.create(university=other_uni, name='CS', code='CS')
        other_course = Course.objects.create(department=other_dept, name='Other', code='OTH101')
        other_req = TemplateRequest.objects.create(
            course=other_course, requested_by=self.admin, software_needed='X', purpose='Y',
            estimated_vcpu=1, estimated_ram_gb=1, estimated_storage_gb=1, status='approved',
        )
        resp = self.client.post('/api/admin/templates/create-job/', {
            'name': 'Cross Uni Template', 'cpu_cores': 1, 'ram_gb': 1, 'disk_gb': 5,
            'iso_volid': 'local:iso/fake.iso', 'desktop_environment_id': self.de_profile.id if self.de_profile else 1,
            'template_request_id': other_req.id,
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_build_exceeding_quota_is_blocked_before_any_real_vm_is_created(self):
        """THE explicit scenario: estimated/requested specs exceed
        remaining quota - confirm a clean, honest rejection, and confirm
        NO TemplateCreationJob row (and therefore no real Proxmox VM) was
        ever created — not a failure partway through."""
        before_count = TemplateCreationJob.objects.count()
        resp = self.client.post('/api/admin/templates/create-job/', {
            'name': 'Too Big Template', 'cpu_cores': 10, 'ram_gb': 4, 'disk_gb': 20,
            'iso_volid': 'local:iso/fake.iso', 'desktop_environment_id': self.de_profile.id if self.de_profile else 1,
            'template_request_id': self.approved_req.id,
        }, format='json')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('vCPU', resp.data['message'])
        self.assertEqual(TemplateCreationJob.objects.count(), before_count)

    def test_build_requires_request_to_be_approved_first(self):
        pending_req = TemplateRequest.objects.create(
            course=self.course, requested_by=self.admin, software_needed='X', purpose='Y',
            estimated_vcpu=1, estimated_ram_gb=1, estimated_storage_gb=1,
        )
        resp = self.client.post('/api/admin/templates/create-job/', {
            'name': 'Premature Template', 'cpu_cores': 1, 'ram_gb': 1, 'disk_gb': 5,
            'iso_volid': 'local:iso/fake.iso', 'desktop_environment_id': self.de_profile.id if self.de_profile else 1,
            'template_request_id': pending_req.id,
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_can_access_template_job_boundary(self):
        """Pure-function boundary for the shared permission helper."""
        job_x = TemplateCreationJob.objects.create(
            name='X job', desktop_environment=self.de_profile, created_by=self.admin,
            university=self.uni, template_request=self.approved_req,
        )
        self.assertTrue(can_access_template_job(self.admin, job_x))

        outsider = User.objects.create_user(username='__t_wz_outsider__', email='wz_outsider@t.com', password='pw12345')
        self.assertFalse(can_access_template_job(outsider, job_x))

        platform_admin = User.objects.create_user(
            username='__t_wz_platadmin__', email='wz_platadmin@t.com', password='pw12345', role='admin')
        self.assertTrue(can_access_template_job(platform_admin, job_x))

        # A platform-wide job (no university link) — university admin
        # must NOT be able to touch it just because they administer some
        # other real university.
        unscoped_job = TemplateCreationJob.objects.create(
            name='Unscoped job', desktop_environment=self.de_profile, created_by=platform_admin,
        )
        self.assertFalse(can_access_template_job(self.admin, unscoped_job))
        self.assertTrue(can_access_template_job(platform_admin, unscoped_job))


class PromoteLinksBackToRequestTests(TestCase):
    """The real, end-to-end close-of-loop logic in AdminTemplateJobPromoteView —
    tested by driving a job directly to 'completed' (skipping the real,
    slow OS-install/Proxmox lifecycle already proven elsewhere) and
    calling the real promote endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Promote Uni', contact_email='p@t.com', contact_name='P', status='active',
            max_vcpu_cores=10, max_ram_gb=20, max_storage_gb=200,
        )
        self.dept = Department.objects.create(university=self.uni, name='CS', code='CS')
        self.course = Course.objects.create(department=self.dept, name='Promote Course', code='PR101')
        self.admin = User.objects.create_user(username='__t_pr_admin__', email='pr_admin@t.com', password='pw12345')
        self.uni.admin_user = self.admin
        self.uni.save()

        self.lecturer = User.objects.create_user(username='__t_pr_lect__', email='pr_lect@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course, user=self.lecturer, role='lecturer')

        self.req = TemplateRequest.objects.create(
            course=self.course, requested_by=self.lecturer, software_needed='MATLAB', purpose='Robotics lab',
            estimated_vcpu=2, estimated_ram_gb=4, estimated_storage_gb=20,
            status='approved', reviewed_at=timezone.now(),
        )
        de_profile = DesktopEnvironmentProfile.objects.first()
        self.job = TemplateCreationJob.objects.create(
            name='__TEST__ Promote Job', desktop_environment=de_profile, cpu_cores=2, ram_gb=4, disk_gb=20,
            status='completed', final_template_id=999999, created_by=self.admin,
            university=self.uni, template_request=self.req,
        )
        self.client.force_authenticate(self.admin)

    def test_promote_links_template_completes_request_assigns_course_and_notifies_lecturer(self):
        resp = self.client.post(f'/api/admin/templates/jobs/{self.job.id}/promote/', {
            'name': '__TEST__ MATLAB Robotics Template', 'price_per_hour': 0,
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
        template_id = resp.data['data']['template_id']

        self.req.refresh_from_db()
        self.assertEqual(self.req.status, 'completed')
        self.assertEqual(self.req.resulting_template_id, template_id)

        self.course.refresh_from_db()
        self.assertEqual(self.course.default_template_id, template_id)

        template = VMTemplate.objects.get(id=template_id)
        self.assertEqual(template.university_id, self.uni.id)

        notif = Notification.objects.filter(
            user=self.lecturer, notification_type='template_request_completed',
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn('PR101', notif.message)

        template.delete()
