"""
Real, confirmed, twice-recurring bug: Proxmox's real name= parameter
for a VM/clone must be a valid DNS label (letters, digits, hyphens
only) — it rejects anything else with a real 400 ("does not look like
a valid DNS name"). This broke live at VM-creation time first (a free-
text request name like "COURSE — software, needed"), got a one-off
inline regex fix there, and then broke AGAIN — for a genuinely real,
live user's real job (#44, name "COUT100 — testing") — at the
isolated-verification clone step, which built its own Proxmox name
directly from job.name and never got the same fix applied to it.

dns_safe_proxmox_name() is the permanent fix: the one, single function
every real Proxmox name= call site in this app must now build its
string through, so this exact class of bug cannot recur in a third
call site the same way it recurred in a second one.
"""
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.vms.models import TemplateCreationJob
from apps.vms.template_wizard_views import dns_safe_proxmox_name


class DnsSafeProxmoxNameTests(SimpleTestCase):
    def test_the_real_job_name_that_actually_broke_production(self):
        # The exact real, live case: job.name = "COUT100 — testing"
        # (an em-dash, not a hyphen, plus spaces) fed through
        # f'verify-{job.name}' broke Proxmox for real.
        result = dns_safe_proxmox_name('verify-COUT100 — testing', fallback='verify-job-44')
        self.assertRegex(result, r'^[a-z0-9-]+$')
        self.assertNotIn(' ', result)
        self.assertNotIn('—', result)

    def test_the_original_request_name_that_broke_it_the_first_time(self):
        result = dns_safe_proxmox_name('COURSE — software, needed', fallback='template-1')
        self.assertRegex(result, r'^[a-z0-9-]+$')

    def test_empty_or_all_punctuation_input_falls_back_honestly(self):
        self.assertEqual(dns_safe_proxmox_name('', fallback='template-9'), 'template-9')
        self.assertEqual(dns_safe_proxmox_name('   —— ,,, ', fallback='template-9'), 'template-9')
        self.assertEqual(dns_safe_proxmox_name(None, fallback='template-9'), 'template-9')

    def test_already_safe_input_is_only_lowercased_not_mangled(self):
        self.assertEqual(dns_safe_proxmox_name('Ubuntu-Server-22', fallback='x'), 'ubuntu-server-22')

    def test_result_is_never_longer_than_proxmoxs_real_63_char_limit(self):
        result = dns_safe_proxmox_name('x' * 100, fallback='y')
        self.assertLessEqual(len(result), 63)


class VerifyViewUsesTheSanitizedNameTests(TestCase):
    """Real, direct proof the fix is actually wired into the endpoint
    that broke in production, not just that the helper function itself
    is correct in isolation."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='__t_dns_verify_admin__', email='dns_verify_admin@t.com', password='pw12345', role='admin',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def tearDown(self):
        TemplateCreationJob.objects.filter(name__startswith='__TEST__').delete()

    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_verify_sends_a_dns_safe_name_for_a_real_unsafe_job_name(self, MockPS):
        # Same real, unsafe pattern that broke production: an em-dash
        # and spaces in the job's own human-readable name.
        job = TemplateCreationJob.objects.create(
            name='__TEST__ COUT100 — testing', status='verifying', proxmox_vmid=99999, created_by=self.admin,
        )
        ps_instance = MockPS.return_value
        ps_instance.clone_template.return_value = 88888
        ps_instance.start_vm.return_value = None
        ps_instance.get_vm_ip.return_value = '10.0.0.5'
        ps_instance.proxmox.nodes.return_value.qemu.return_value.agent.exec.post.return_value = {'pid': 1}
        ps_instance.proxmox.nodes.return_value.qemu.return_value.agent.return_value.get.return_value = {
            'exited': 1, 'out-data': 'a' * 32,
        }
        ps_instance.delete_vm_completely.return_value = None

        resp = self.client.post(f'/api/admin/templates/jobs/{job.id}/verify/')
        self.assertEqual(resp.status_code, 200, resp.content)

        # The real, precise regression this guards: whatever name was
        # actually sent to Proxmox must be DNS-safe, not the raw
        # "verify-__TEST__ COUT100 — testing".
        called_name = ps_instance.clone_template.call_args[0][1]
        self.assertRegex(called_name, r'^[a-z0-9-]+$')
        self.assertNotIn(' ', called_name)
        self.assertNotIn('—', called_name)
