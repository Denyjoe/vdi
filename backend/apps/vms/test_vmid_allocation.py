"""
Real, confirmed bug (found live, not hypothesized): get_next_vmid()
used to compute max(Proxmox's CURRENT live VM list) + 1 with no
awareness of this app's own historical records. Once a higher-numbered
VM got cleaned up, Proxmox's live max genuinely dropped, and a later
job could be handed a real vmid an older, still-open
TemplateCreationJob row already claimed.

Confirmed live in this session's real dev database: 9 separate real
TemplateCreationJob rows ended up sharing vmid=9027 this way, with job
#31 still sitting in the wizard's "resume in-progress job" state while
its real VM had actually been silently taken over by a later, unrelated
job (#38) — the exact mechanism behind "resume a job, see something
stuck/unrelated".

Fixed by unioning Proxmox's live list with every vmid this app has
EVER assigned (TemplateCreationJob.proxmox_vmid, VirtualMachine.
proxmox_vm_id). Tested here with a fake, deterministic Proxmox client
(the one place mocking is appropriate in this otherwise real-
infrastructure-first codebase — the real bug is a pure logic error,
independent of any specific live Proxmox state, and reliably
reproducing "Proxmox's live max just dropped below a real historical
record" against the actual server would mean deliberately destroying
real VMs mid-test).
"""
from django.test import TestCase

from apps.users.models import User
from apps.vms.models import DesktopEnvironmentProfile, TemplateCreationJob, VirtualMachine, VMTemplate
from apps.vms.services.proxmox_service import ProxmoxService


class _FakeQemuResource:
    """Mirrors proxmoxer's real dual usage on the same node.qemu
    accessor: `.qemu.get()` (the live list, no vmid — what
    get_next_vmid() calls) AND `.qemu(vmid)` (a specific VM resource,
    used by every OTHER real method in this service)."""
    def __init__(self, vms):
        self._vms = vms

    def get(self):
        return self._vms

    def __call__(self, vmid):
        return self


class _FakeNode:
    def __init__(self, vms):
        self.qemu = _FakeQemuResource(vms)


class _FakeProxmoxClient:
    def __init__(self, vms):
        self._vms = vms

    def nodes(self, node):
        return _FakeNode(self._vms)


def _service_with_fake_proxmox(live_vmids):
    ps = ProxmoxService()
    ps._client = _FakeProxmoxClient([{'vmid': v} for v in live_vmids])
    return ps


class GetNextVmidRealHistoricalConflictTests(TestCase):
    def setUp(self):
        self.de = DesktopEnvironmentProfile.objects.filter(name='xfce').first() \
            or DesktopEnvironmentProfile.objects.create(name='xfce', display_name='XFCE', session_command='startxfce4')
        self.admin = User.objects.create_user(username='__t_vmid_admin__', email='vmid_admin@t.com', password='pw12345')

    def test_next_vmid_never_reuses_a_real_historical_job_vmid_even_after_proxmox_cleanup(self):
        """The exact real scenario: an older job (still open) claims
        9027; Proxmox's live list has since dropped to a lower max
        (9020) because higher VMs were cleaned up elsewhere — the OLD
        buggy formula would have returned 9021, genuinely colliding
        with nothing live, but a NEW call after 9027 exists as history
        must still skip it."""
        TemplateCreationJob.objects.create(
            name='__TEST__ Historical Job', desktop_environment=self.de,
            proxmox_vmid=9027, status='awaiting_os_install', created_by=self.admin,
        )
        # Proxmox's live list has genuinely dropped below 9027 (cleanup
        # elsewhere) — the buggy old formula would compute 9021 here,
        # which is live-free but still a real historical collision risk
        # once 9027 itself later reappears as "current max" again.
        # The real, concrete regression this guards: it must never
        # return 9027 itself while that job is still open, regardless
        # of what Proxmox's live list currently shows.
        ps = _service_with_fake_proxmox([9020, 9021, 9022])
        next_id = ps.get_next_vmid()
        self.assertNotEqual(next_id, 9027)
        self.assertEqual(next_id, 9028)  # max(9020..9022, 9027) + 1

    def test_next_vmid_also_respects_real_virtualmachine_records(self):
        template = VMTemplate.objects.create(
            name='__TEST__ VMID Template', description='x', cpu_cores=2, ram_gb=4, storage_gb=20, os='Ubuntu',
        )
        owner = User.objects.create_user(username='__t_vmid_owner__', email='vmid_owner@t.com', password='pw12345')
        vm = VirtualMachine.objects.create(name='vm', owner=owner, template=template, status='stopped', proxmox_vm_id=9050)

        ps = _service_with_fake_proxmox([9040])
        next_id = ps.get_next_vmid()
        self.assertNotEqual(next_id, 9050)
        self.assertEqual(next_id, 9051)

        vm.delete()
        template.delete()

    def test_next_vmid_still_works_normally_with_no_historical_records(self):
        ps = _service_with_fake_proxmox([200, 201])
        self.assertEqual(ps.get_next_vmid(), 202)

    def test_next_vmid_returns_110_when_nothing_exists_anywhere(self):
        ps = _service_with_fake_proxmox([])
        self.assertEqual(ps.get_next_vmid(), 110)


class ActiveJobsStaleVmidDetectionTests(TestCase):
    """The complementary, already-corrupted-data-facing fix:
    AdminActiveTemplateJobsView must recognize a job whose real vmid
    was reused by a LATER job as stale, even though the VM itself
    still genuinely exists and is reachable."""

    def setUp(self):
        self.de = DesktopEnvironmentProfile.objects.filter(name='xfce').first() \
            or DesktopEnvironmentProfile.objects.create(name='xfce', display_name='XFCE', session_command='startxfce4')
        self.admin = User.objects.create_user(username='__t_stale_admin__', email='stale_admin@t.com', password='pw12345', role='admin')

    def test_older_job_sharing_a_vmid_with_a_newer_job_is_marked_failed(self):
        from django.utils import timezone
        import datetime

        older = TemplateCreationJob.objects.create(
            name='__TEST__ Older', desktop_environment=self.de,
            proxmox_vmid=9099, status='awaiting_os_install', created_by=self.admin,
        )
        older.created_at = timezone.now() - datetime.timedelta(days=1)
        older.save(update_fields=['created_at'])

        newer = TemplateCreationJob.objects.create(
            name='__TEST__ Newer', desktop_environment=self.de,
            proxmox_vmid=9099, status='awaiting_os_install', created_by=self.admin,
        )

        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(self.admin)
        resp = client.get('/api/admin/templates/jobs/active/')
        self.assertEqual(resp.status_code, 200)

        older.refresh_from_db()
        self.assertEqual(older.status, 'failed')
        self.assertIn('reused by a later template build', older.error_message)
        self.assertIn(str(newer.id), older.error_message)

        # The newer job is never touched by THIS check (the
        # superseded_by lookup only ever looks backward at older
        # jobs) — whatever else happens to it here depends on whether
        # vmid 9099 is reachable on the real Proxmox server this test
        # run talks to, which is real-environment-dependent and not
        # what this test is proving.

        older.delete()
        newer.delete()
