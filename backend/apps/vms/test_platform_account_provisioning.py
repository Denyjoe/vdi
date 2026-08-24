"""
Real, confirmed, systemic root cause of a recurring real xrdp failure:
"sesman connect ok... login failed for display 0." Confirmed directly
from the real xrdp-sesman.log on the actual, currently-affected
production VM: "pam_authenticate failed: Authentication failure /
Username or password error for user: ospace" — and confirmed further
that `id ospace` on that real VM genuinely returns "no such user".

Every real production RDP/SSH login this platform makes (pool
assignment, direct provisioning, server-type SSH) is hardcoded
elsewhere to VM_DEFAULT_USER/VM_DEFAULT_PASSWORD — but nothing in the
wizard's own build flow ever provisioned that exact account on the
template itself. The OS installer's own account-creation screen lets
the admin type any username/password they want for their own manual
SSH work in the wizard; neither desktop fix_script has ever touched
user accounts. A template built by an admin who (reasonably) named
their own account something else silently promotes, finalizes, and
verifies fine — then fails this exact way for every real student
session against it.

These tests prove the real, permanent fix: AdminTemplateJobApplyConfigurationView
now unconditionally provisions/repairs the real platform login account
on every build, for both desktop and server jobs, using a real
request/response cycle with only the SSH/Proxmox network boundary
faked.
"""
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.users.models import User
from apps.vms.models import DesktopEnvironmentProfile, TemplateCreationJob


def _get_or_create_xfce():
    return DesktopEnvironmentProfile.objects.filter(name='xfce').first() or \
        DesktopEnvironmentProfile.objects.create(
            name='xfce', display_name='XFCE', session_command='startxfce4',
        )


def _ok(stdout=''):
    return {'success': True, 'stdout': stdout, 'stderr': '', 'exit_code': 0}


class PlatformAccountProvisioningTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='__t_acct_prov_admin__', email='acct_prov_admin@t.com', password='pw12345', role='admin',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def tearDown(self):
        TemplateCreationJob.objects.filter(name__startswith='__TEST__').delete()

    @patch('apps.vms.services.ssh_service.run_ssh_script')
    @patch('apps.vms.services.ssh_service.run_ssh_command')
    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_desktop_job_provisions_the_real_platform_account(self, MockPS, mock_run_cmd, mock_run_script):
        de = _get_or_create_xfce()
        instance = MockPS.return_value
        instance.get_vm_ip.return_value = '10.0.0.60'
        instance.detach_install_iso_and_fix_boot_order.return_value = None
        mock_run_cmd.side_effect = [
            _ok('connected'),  # sanity check
            _ok(de.session_command.strip()),  # startwm.sh verify read-back
        ]
        mock_run_script.return_value = _ok('uid=1001(ospace) groups=1001(ospace),27(sudo)')

        job = TemplateCreationJob.objects.create(
            name='__TEST__ Account Provision Desktop', template_type='desktop', desktop_environment=de,
            status='awaiting_os_install', proxmox_vmid=77771, created_by=self.admin,
        )

        resp = self.client.post(f'/api/admin/templates/jobs/{job.id}/apply-configuration/', {
            'ssh_username': 'admin_chosen_name', 'ssh_password': 'whatever-the-admin-typed',
        }, format='json')

        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['data']['status'], 'installing_apps')

        # Real, precise proof: the real platform account name/password
        # were actually sent to the VM, regardless of what SSH account
        # the admin themselves used to build it.
        all_script_calls = [str(call) for call in mock_run_script.call_args_list]
        self.assertTrue(any('ospace' in c for c in all_script_calls), all_script_calls)
        self.assertTrue(any('1234567890' in c or 'chpasswd' in c for c in all_script_calls), all_script_calls)

    @patch('apps.vms.services.ssh_service.run_ssh_script')
    @patch('apps.vms.services.ssh_service.run_ssh_command')
    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_server_job_also_provisions_the_real_platform_account(self, MockPS, mock_run_cmd, mock_run_script):
        # A server-type job has no desktop step at all, but its SSH
        # login uses the exact same real platform account — this must
        # run for server jobs too, not just desktop ones.
        instance = MockPS.return_value
        instance.get_vm_ip.return_value = '10.0.0.61'
        instance.detach_install_iso_and_fix_boot_order.return_value = None
        mock_run_cmd.return_value = _ok('connected')
        mock_run_script.return_value = _ok('uid=1001(ospace)')

        job = TemplateCreationJob.objects.create(
            name='__TEST__ Account Provision Server', template_type='server', desktop_environment=None,
            status='awaiting_os_install', proxmox_vmid=77772, created_by=self.admin,
        )

        resp = self.client.post(f'/api/admin/templates/jobs/{job.id}/apply-configuration/', {
            'ssh_username': 'admin_chosen_name', 'ssh_password': 'whatever-the-admin-typed',
        }, format='json')

        self.assertEqual(resp.status_code, 200, resp.content)
        all_script_calls = [str(call) for call in mock_run_script.call_args_list]
        self.assertTrue(any('ospace' in c for c in all_script_calls), all_script_calls)

    @patch('apps.vms.services.ssh_service.run_ssh_script')
    @patch('apps.vms.services.ssh_service.run_ssh_command')
    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_provisioning_failure_fails_the_job_honestly_not_silently(self, MockPS, mock_run_cmd, mock_run_script):
        # Adversarial: if the real platform account genuinely can't be
        # provisioned (e.g. useradd fails for a real reason), the job
        # must fail loudly here — never silently continue to a
        # template that will fail for every real student later.
        de = _get_or_create_xfce()
        instance = MockPS.return_value
        instance.get_vm_ip.return_value = '10.0.0.62'
        instance.detach_install_iso_and_fix_boot_order.return_value = None
        mock_run_cmd.return_value = _ok('connected')

        def script_side_effect(ip, user, pwd, script, timeout=None):
            if 'ospace' in script or 'chpasswd' in script:
                return {'success': False, 'stdout': '', 'stderr': 'useradd: real permission denied', 'exit_code': 1}
            return _ok()

        mock_run_script.side_effect = script_side_effect

        job = TemplateCreationJob.objects.create(
            name='__TEST__ Account Provision Failure', template_type='desktop', desktop_environment=de,
            status='awaiting_os_install', proxmox_vmid=77773, created_by=self.admin,
        )

        resp = self.client.post(f'/api/admin/templates/jobs/{job.id}/apply-configuration/', {
            'ssh_username': 'admin_chosen_name', 'ssh_password': 'whatever-the-admin-typed',
        }, format='json')

        self.assertEqual(resp.status_code, 502)
        job.refresh_from_db()
        self.assertEqual(job.status, 'failed')
        self.assertIn('ospace', job.error_message)

    @patch('apps.vms.services.ssh_service.run_ssh_script')
    @patch('apps.vms.services.ssh_service.run_ssh_command')
    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    @override_settings()
    def test_uses_the_real_configured_platform_credentials_not_hardcoded(self, MockPS, mock_run_cmd, mock_run_script):
        # Real proof this reads the actual, live-configured
        # VM_DEFAULT_USER/VM_DEFAULT_PASSWORD rather than a hardcoded
        # literal — stays correct even if the platform's real config
        # changes.
        de = _get_or_create_xfce()
        instance = MockPS.return_value
        instance.get_vm_ip.return_value = '10.0.0.63'
        instance.detach_install_iso_and_fix_boot_order.return_value = None
        mock_run_cmd.side_effect = [
            _ok('connected'),  # sanity check
            _ok(de.session_command.strip()),  # startwm.sh verify read-back
        ]
        mock_run_script.return_value = _ok()

        job = TemplateCreationJob.objects.create(
            name='__TEST__ Account Provision Config', template_type='desktop', desktop_environment=de,
            status='awaiting_os_install', proxmox_vmid=77774, created_by=self.admin,
        )

        with patch('decouple.config') as mock_config:
            def config_side_effect(key, default=None):
                if key == 'VM_DEFAULT_USER':
                    return 'customplatformuser'
                if key == 'VM_DEFAULT_PASSWORD':
                    return 'customplatformpass'
                return default
            mock_config.side_effect = config_side_effect

            resp = self.client.post(f'/api/admin/templates/jobs/{job.id}/apply-configuration/', {
                'ssh_username': 'admin_chosen_name', 'ssh_password': 'whatever-the-admin-typed',
            }, format='json')

        self.assertEqual(resp.status_code, 200, resp.content)
        all_script_calls = [str(call) for call in mock_run_script.call_args_list]
        self.assertTrue(any('customplatformuser' in c for c in all_script_calls), all_script_calls)
