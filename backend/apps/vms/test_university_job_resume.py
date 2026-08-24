"""
Real, confirmed bug: a university admin who left the wizard mid-build
had genuinely no way back to it. The resume MECHANISM itself
(AdminActiveTemplateJobsView, permission_classes=IsPlatformOrUniversityAdmin,
scoped by created_by=request.user) was already correct — confirmed live
by navigating a real university admin directly to /admin/templates/new,
where the resume banner appeared correctly. The real gap was entirely
in the frontend entry point: TemplateRequestQueuePanel.jsx's "History"
list rendered an approved-and-still-building request as a plain,
non-interactive status badge, with no button or link back to the
wizard at all — closed by a real "Continue Build" action reusing the
exact same route/mechanism, not a second parallel resume system.

These tests prove the backend side of that claim directly: the
resume-check endpoint is genuinely, correctly scoped per-admin, and
never leaks a job across two real, different universities.
"""
from unittest.mock import MagicMock, patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.university.models import University
from apps.users.models import User
from apps.vms.models import DesktopEnvironmentProfile, TemplateCreationJob


def _get_or_create_xfce():
    return DesktopEnvironmentProfile.objects.filter(name='xfce').first() or \
        DesktopEnvironmentProfile.objects.create(
            name='xfce', display_name='XFCE', session_command='startxfce4',
        )


def _proxmox_that_says_every_vm_exists():
    ps = MagicMock()
    ps.proxmox.nodes.return_value.qemu.return_value.status.current.get.return_value = {'status': 'running'}
    return ps


class UniversityAdminJobResumeTests(TestCase):
    def setUp(self):
        self.de = _get_or_create_xfce()

        self.admin_a = User.objects.create_user(
            username='__t_uni_a_admin__', email='uni_a_admin@t.com', password='pw12345', role='user',
        )
        self.uni_a = University.objects.create(
            name='__TEST__ University A', contact_email='a@t.com', contact_name='Admin A',
            status='active', admin_user=self.admin_a,
        )

        self.admin_b = User.objects.create_user(
            username='__t_uni_b_admin__', email='uni_b_admin@t.com', password='pw12345', role='user',
        )
        self.uni_b = University.objects.create(
            name='__TEST__ University B', contact_email='b@t.com', contact_name='Admin B',
            status='active', admin_user=self.admin_b,
        )

        # A real, currently in-progress job — University A's admin left
        # the wizard mid-build, exactly the reported scenario.
        self.job_a = TemplateCreationJob.objects.create(
            name='__TEST__ University A In-Progress Job', desktop_environment=self.de,
            status='awaiting_os_install', proxmox_vmid=88881,
            created_by=self.admin_a, university=self.uni_a,
        )

    def tearDown(self):
        TemplateCreationJob.objects.filter(name__startswith='__TEST__').delete()
        University.objects.filter(name__startswith='__TEST__').delete()

    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_university_admin_sees_their_own_in_progress_job_in_the_resume_list(self, MockPS):
        MockPS.return_value = _proxmox_that_says_every_vm_exists()
        client = APIClient()
        client.force_authenticate(self.admin_a)
        resp = client.get('/api/admin/templates/jobs/active/')
        self.assertEqual(resp.status_code, 200, resp.content)
        job_ids = [j['id'] for j in resp.data['data']]
        self.assertIn(self.job_a.id, job_ids)

    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_a_different_universitys_admin_never_sees_it_in_their_resume_list(self, MockPS):
        # The real cross-tenant boundary: University B's admin must
        # NEVER see University A's in-progress job in their own
        # resume-check response.
        MockPS.return_value = _proxmox_that_says_every_vm_exists()
        client = APIClient()
        client.force_authenticate(self.admin_b)
        resp = client.get('/api/admin/templates/jobs/active/')
        self.assertEqual(resp.status_code, 200, resp.content)
        job_ids = [j['id'] for j in resp.data['data']]
        self.assertNotIn(self.job_a.id, job_ids)
        self.assertEqual(job_ids, [])

    def test_a_different_universitys_admin_cannot_directly_open_it_either(self):
        # Even knowing the real job id directly (not just the list),
        # the real per-object permission check must still block it.
        client = APIClient()
        client.force_authenticate(self.admin_b)
        resp = client.get(f'/api/admin/templates/jobs/{self.job_a.id}/')
        self.assertEqual(resp.status_code, 403, resp.content)

    def test_university_admin_can_directly_open_their_own_job(self):
        client = APIClient()
        client.force_authenticate(self.admin_a)
        resp = client.get(f'/api/admin/templates/jobs/{self.job_a.id}/')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['data']['id'], self.job_a.id)

    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_platform_admin_resume_flow_unaffected_regression(self, MockPS):
        # Real regression guard: a platform admin's own jobs (no
        # university at all) must keep working exactly as before —
        # this fix must never narrow their existing access.
        MockPS.return_value = _proxmox_that_says_every_vm_exists()
        platform_admin = User.objects.create_user(
            username='__t_platform_admin_resume__', email='platform_admin_resume@t.com',
            password='pw12345', role='admin',
        )
        platform_job = TemplateCreationJob.objects.create(
            name='__TEST__ Platform Admin Job', desktop_environment=self.de,
            status='awaiting_os_install', proxmox_vmid=88882,
            created_by=platform_admin,
        )
        try:
            client = APIClient()
            client.force_authenticate(platform_admin)
            resp = client.get('/api/admin/templates/jobs/active/')
            self.assertEqual(resp.status_code, 200, resp.content)
            job_ids = [j['id'] for j in resp.data['data']]
            self.assertIn(platform_job.id, job_ids)
            self.assertNotIn(self.job_a.id, job_ids)
        finally:
            platform_job.delete()
