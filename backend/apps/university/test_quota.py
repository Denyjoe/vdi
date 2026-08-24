"""
Phase 1 (Product Depth Layer) — real tests for the hardware quota
system: usage summation, pre-flight enforcement, and the two real
enforcement points (workspace launch, session participant join).
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.vms.models import VMTemplate, Workspace, VirtualMachine
from apps.sessions.models import LiveSession, SessionParticipant
from .models import University, Department, Course, UniversityAffiliation, CourseEnrollment
from .services.quota_service import get_university_resource_usage, check_quota_allows


class ResourceUsageSummationTests(TestCase):
    def setUp(self):
        self.uni = University.objects.create(
            name='__TEST__ Quota Uni', contact_email='q@t.com', contact_name='Q', status='active',
            max_vcpu_cores=10, max_ram_gb=32, max_storage_gb=200,
        )
        self.t1 = VMTemplate.objects.create(
            name='__TEST__ Quota T1', description='x', cpu_cores=2, ram_gb=4, storage_gb=20,
            os='Linux', university=self.uni,
        )
        self.t2 = VMTemplate.objects.create(
            name='__TEST__ Quota T2', description='x', cpu_cores=3, ram_gb=6, storage_gb=30,
            os='Linux', university=self.uni,
        )
        # A template belonging to a DIFFERENT university must never count.
        self.other_uni = University.objects.create(
            name='__TEST__ Other Quota Uni', contact_email='oq@t.com', contact_name='OQ', status='active',
            max_vcpu_cores=10, max_ram_gb=32, max_storage_gb=200,
        )
        VMTemplate.objects.create(
            name='__TEST__ Other Uni Template', description='x', cpu_cores=99, ram_gb=99, storage_gb=99,
            os='Linux', university=self.other_uni,
        )

    def test_template_only_usage_summed_correctly(self):
        usage = get_university_resource_usage(self.uni)
        self.assertEqual(usage['vcpu_used'], 5)   # 2 + 3
        self.assertEqual(usage['ram_gb_used'], 10)  # 4 + 6
        self.assertEqual(usage['storage_gb_used'], 50)  # 20 + 30
        self.assertEqual(usage['vcpu_max'], 10)
        self.assertEqual(usage['percent_used']['vcpu'], 50.0)
        template_names = {t['name'] for t in usage['templates']}
        self.assertEqual(template_names, {'__TEST__ Quota T1', '__TEST__ Quota T2'})

    def test_other_universitys_templates_never_leak_into_usage(self):
        usage = get_university_resource_usage(self.uni)
        self.assertEqual(usage['vcpu_used'], 5)  # NOT 5 + 99
        names = {t['name'] for t in usage['templates']}
        self.assertNotIn('__TEST__ Other Uni Template', names)

    def test_running_vm_without_proxmox_vm_id_adds_marginal_cost(self):
        """A running clone (no real proxmox_vm_id set — the live-status
        cross-check is skipped, matching how a simulated/is_real=False VM
        genuinely has none) adds its template's spec ON TOP of that
        template's own static contribution — two real, separate cost
        components, not a double-count of the same one."""
        student = User.objects.create_user(username='__t_quota_stu__', email='quota_stu@t.com', password='pw12345')
        VirtualMachine.objects.create(
            name='__TEST__ Running Clone', owner=student, template=self.t1, status='running', proxmox_vm_id=None,
        )
        usage = get_university_resource_usage(self.uni)
        # Static (2+3=5) + this one running clone of t1 (2) = 7
        self.assertEqual(usage['vcpu_used'], 7)
        self.assertEqual(usage['ram_gb_used'], 14)  # 10 + 4
        running_names = {v['name'] for v in usage['running_vms']}
        self.assertIn('__TEST__ Running Clone', running_names)

    def test_stopped_vm_never_counted_as_running(self):
        student = User.objects.create_user(username='__t_quota_stu2__', email='quota_stu2@t.com', password='pw12345')
        VirtualMachine.objects.create(
            name='__TEST__ Stopped Clone', owner=student, template=self.t1, status='stopped', proxmox_vm_id=None,
        )
        usage = get_university_resource_usage(self.uni)
        self.assertEqual(usage['vcpu_used'], 5)  # unchanged - stopped VM excluded entirely
        self.assertEqual(usage['running_vms'], [])


class CheckQuotaAllowsTests(TestCase):
    def setUp(self):
        self.uni = University.objects.create(
            name='__TEST__ Preflight Uni', contact_email='p@t.com', contact_name='P', status='active',
            max_vcpu_cores=8, max_ram_gb=16, max_storage_gb=100,
        )
        VMTemplate.objects.create(
            name='__TEST__ Preflight Template', description='x', cpu_cores=6, ram_gb=8, storage_gb=40,
            os='Linux', university=self.uni,
        )
        # Baseline usage: vcpu=6/8, ram=8/16, storage=40/100 -> 2 vCPU headroom.

    def test_addition_that_exactly_fits_is_allowed(self):
        allowed, message = check_quota_allows(self.uni, additional_vcpu=2, additional_ram_gb=0, additional_storage_gb=0)
        self.assertTrue(allowed)

    def test_addition_that_exceeds_by_one_is_rejected_with_real_numbers(self):
        allowed, message = check_quota_allows(self.uni, additional_vcpu=3, additional_ram_gb=0, additional_storage_gb=0)
        self.assertFalse(allowed)
        self.assertIn('6', message)   # used
        self.assertIn('8', message)   # max
        self.assertIn('2', message)   # remaining

    def test_ram_and_storage_checked_independently(self):
        # vCPU fits (2 remaining, asking for 1), but RAM does not (8
        # remaining, asking for 20).
        allowed, message = check_quota_allows(self.uni, additional_vcpu=1, additional_ram_gb=20, additional_storage_gb=0)
        self.assertFalse(allowed)
        self.assertIn('RAM', message)

    def test_zero_additional_is_always_allowed(self):
        allowed, _ = check_quota_allows(self.uni, 0, 0, 0)
        self.assertTrue(allowed)


class WorkspaceLaunchQuotaEnforcementTests(TestCase):
    """Real HTTP-level enforcement at the actual launch endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Launch Quota Uni', contact_email='l@t.com', contact_name='L', status='active',
            max_vcpu_cores=2, max_ram_gb=4, max_storage_gb=50,
        )
        # This template's own static footprint already consumes the ENTIRE
        # quota (2 vCPU) before anything even runs.
        self.tight_template = VMTemplate.objects.create(
            name='__TEST__ Tight Template', description='x', cpu_cores=2, ram_gb=4, storage_gb=20,
            os='Linux', university=self.uni, is_real=False, price_per_hour=0,
        )
        self.roomy_uni = University.objects.create(
            name='__TEST__ Roomy Quota Uni', contact_email='r2@t.com', contact_name='R2', status='active',
            max_vcpu_cores=20, max_ram_gb=40, max_storage_gb=500,
        )
        self.roomy_template = VMTemplate.objects.create(
            name='__TEST__ Roomy Template', description='x', cpu_cores=2, ram_gb=4, storage_gb=20,
            os='Linux', university=self.roomy_uni, is_real=False, price_per_hour=0,
        )

        self.user = User.objects.create_user(username='__t_launch_user__', email='launch_user@t.com', password='pw12345')
        self.client.force_authenticate(self.user)

    def test_launch_against_already_full_quota_is_blocked(self):
        ws = Workspace.objects.create(owner=self.user, name='__TEST__ Tight WS', vm_template=self.tight_template, status='stopped')
        resp = self.client.post(f'/api/workspaces/{ws.id}/launch/')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('quota', resp.data['message'].lower())
        ws.refresh_from_db()
        self.assertNotEqual(ws.status, 'active')

    def test_launch_against_roomy_quota_is_allowed_through_to_provisioning(self):
        """Positive control — quota check itself doesn't block a launch
        that genuinely fits (whatever happens after is unrelated to
        quota, this only proves the 409 doesn't fire)."""
        ws = Workspace.objects.create(owner=self.user, name='__TEST__ Roomy WS', vm_template=self.roomy_template, status='stopped')
        resp = self.client.post(f'/api/workspaces/{ws.id}/launch/')
        self.assertNotEqual(resp.status_code, 409)

    def test_launch_against_non_university_template_never_quota_checked(self):
        """The overwhelming majority of real, existing traffic — a
        personal template — must be completely unaffected."""
        personal_template = VMTemplate.objects.create(
            name='__TEST__ Personal Launch Template', description='x', cpu_cores=99, ram_gb=99, storage_gb=99,
            os='Linux', is_real=False, price_per_hour=0,  # university=None
        )
        ws = Workspace.objects.create(owner=self.user, name='__TEST__ Personal WS', vm_template=personal_template, status='stopped')
        resp = self.client.post(f'/api/workspaces/{ws.id}/launch/')
        self.assertNotEqual(resp.status_code, 409)


class SessionParticipantJoinQuotaEnforcementTests(TestCase):
    """Real HTTP-level enforcement at the actual session-join endpoint —
    the fan-out point where MANY participants could otherwise blow past
    a university's real ceiling one join at a time."""

    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Join Quota Uni', contact_email='j@t.com', contact_name='J', status='active',
            max_vcpu_cores=1, max_ram_gb=2, max_storage_gb=20,
        )
        self.dept = Department.objects.create(university=self.uni, name='CS', code='CS')
        self.course = Course.objects.create(department=self.dept, name='Networks', code='NET201')
        self.template = VMTemplate.objects.create(
            name='__TEST__ Join Quota Template', description='x', cpu_cores=2, ram_gb=2, storage_gb=10,
            os='Linux', university=self.uni, is_real=False, price_per_hour=0,
        )
        # Template alone already exceeds max_vcpu_cores=1 (2 > 1) - any
        # join attempt must be blocked immediately.

        self.host = User.objects.create_user(username='__t_join_host__', email='join_host@t.com', password='pw12345')
        CourseEnrollment.objects.create(course=self.course, user=self.host, role='lecturer')

        from django.utils import timezone
        self.session = LiveSession.objects.create(
            host=self.host, name='__TEST__ Quota Class Session', course=self.course,
            required_vm_template=self.template, invite_code='QUOTAJ01',
            start_time=timezone.now(), end_time=timezone.now(), status='active',
        )

        self.student = User.objects.create_user(username='__t_join_student__', email='join_student@t.com', password='pw12345')
        self.client.force_authenticate(self.student)

    def test_join_blocked_when_quota_already_exceeded(self):
        resp = self.client.post('/api/sessions/live/join/', {'invite_code': self.session.invite_code}, format='json')
        self.assertEqual(resp.status_code, 409, resp.data)
        self.assertIn('quota', resp.data['message'].lower())
        self.assertFalse(SessionParticipant.objects.filter(session=self.session, user=self.student, vm__isnull=False).exists())
        participant = SessionParticipant.objects.filter(session=self.session, user=self.student).first()
        if participant:
            self.assertEqual(participant.status, 'error')

    def test_join_for_non_university_session_never_quota_checked(self):
        from django.utils import timezone
        personal_template = VMTemplate.objects.create(
            name='__TEST__ Personal Join Template', description='x', cpu_cores=99, ram_gb=99, storage_gb=99,
            os='Linux', is_real=False, price_per_hour=0,
        )
        personal_session = LiveSession.objects.create(
            host=self.host, name='__TEST__ Personal Session', required_vm_template=personal_template,
            invite_code='PERSJ001', start_time=timezone.now(), end_time=timezone.now(), status='active',
        )
        resp = self.client.post('/api/sessions/live/join/', {'invite_code': personal_session.invite_code}, format='json')
        self.assertNotEqual(resp.status_code, 409)


class UniversityHardwareViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.uni = University.objects.create(
            name='__TEST__ Hardware Page Uni', contact_email='h@t.com', contact_name='H', status='active',
            max_vcpu_cores=10, max_ram_gb=20, max_storage_gb=100,
        )
        self.admin = User.objects.create_user(username='__t_hw_admin__', email='hw_admin@t.com', password='pw12345')
        self.uni.admin_user = self.admin
        self.uni.save()
        VMTemplate.objects.create(
            name='__TEST__ HW Template', description='x', cpu_cores=4, ram_gb=8, storage_gb=40,
            os='Linux', university=self.uni,
        )

    def test_own_university_hardware_page_loads_real_usage(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/hardware/')
        self.assertEqual(resp.status_code, 200)
        data = resp.data['data']
        self.assertEqual(data['vcpu_used'], 4)
        self.assertEqual(data['vcpu_max'], 10)
        self.assertEqual(len(data['templates']), 1)

    def test_crafted_hardware_request_for_other_university_is_blocked(self):
        outsider = User.objects.create_user(username='__t_hw_outsider__', email='hw_outsider@t.com', password='pw12345')
        self.client.force_authenticate(outsider)
        resp = self.client.get(f'/api/university-admin/universities/{self.uni.id}/hardware/')
        self.assertEqual(resp.status_code, 403)
        self.assertNotIn('data', resp.data)
