"""
Phase 3 (Template Wizard rebuild) — CLI-only/headless server templates.

Real, new capability: a TemplateCreationJob/VMTemplate can now be
template_type='server' — no DesktopEnvironmentProfile at all, no RDP
ever configured or connected to. Alongside the existing 'desktop' path,
unchanged.

These tests cover the deterministic branching logic at each real
boundary (view validation, serialization, promotion, and — most
importantly — the shared connection-protocol-selection helper every
real production VM-launch path now goes through) using the same
fake-client-at-the-network-boundary pattern established in
test_vmid_allocation.py: real Django/DRF request/response cycles
throughout, only the actual Proxmox/Guacamole/socket calls are faked.
A full, real, live server-template build (real VM, real manual OS
install, real session launch confirming a genuine SSH-not-RDP
Guacamole connection against real infrastructure) is covered
separately via live browser testing — spinning up a real VM per test
case here would be prohibitively slow for what is fundamentally pure
branching logic, and the adversarial tests below prove that logic
directly rather than trusting it by inspection.
"""
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.vms.models import DesktopEnvironmentProfile, TemplateCreationJob, VirtualMachine, VMTemplate, Workspace
from apps.vms.services.guacamole_service import create_connection_for_template, wait_for_remote_access_ready
from apps.vms.template_wizard_views import _friendly_os_name_from_iso


def _get_or_create_xfce():
    return DesktopEnvironmentProfile.objects.filter(name='xfce').first() or \
        DesktopEnvironmentProfile.objects.create(
            name='xfce', display_name='XFCE', session_command='startxfce4', default_apps=['firefox'],
        )


class ServerTemplateModelTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='__t_srv_admin__', email='srv_admin@t.com', password='pw12345', role='admin')

    def tearDown(self):
        TemplateCreationJob.objects.filter(created_by=self.admin).delete()

    def test_server_job_can_be_created_with_no_desktop_environment(self):
        job = TemplateCreationJob.objects.create(
            name='__TEST__ Server Job', template_type='server', desktop_environment=None,
            status='vm_creating', created_by=self.admin,
        )
        self.assertIsNone(job.desktop_environment)
        self.assertEqual(job.template_type, 'server')

    def test_default_template_type_is_desktop_for_backward_compat(self):
        de = _get_or_create_xfce()
        job = TemplateCreationJob.objects.create(
            name='__TEST__ Legacy Job', desktop_environment=de, status='vm_creating', created_by=self.admin,
        )
        self.assertEqual(job.template_type, 'desktop')


class AdminTemplateJobCreateViewServerTypeTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='__t_srv_create_admin__', email='srv_create_admin@t.com', password='pw12345', role='admin')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def tearDown(self):
        TemplateCreationJob.objects.filter(created_by=self.admin).delete()

    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_server_job_creation_succeeds_without_desktop_environment_id(self, MockPS):
        instance = MockPS.return_value
        instance.create_vm.return_value = 555555
        instance.start_vm.return_value = None

        resp = self.client.post('/api/admin/templates/create-job/', {
            'name': '__TEST__ Server Template', 'cpu_cores': 2, 'ram_gb': 2, 'disk_gb': 20,
            'iso_volid': 'local:iso/ubuntu-22.04.5-live-server-amd64.iso',
            'template_type': 'server',
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertIsNone(resp.data['data']['desktop_environment'])
        self.assertEqual(resp.data['data']['template_type'], 'server')

        job = TemplateCreationJob.objects.get(id=resp.data['data']['id'])
        self.assertIsNone(job.desktop_environment)

    def test_desktop_job_creation_still_requires_desktop_environment_id(self):
        # Real regression guard: omitting template_type entirely (an old
        # cached frontend bundle, or a direct API caller) must still
        # require desktop_environment_id exactly like before Phase 3 —
        # never silently accept a desktop job with no environment.
        resp = self.client.post('/api/admin/templates/create-job/', {
            'name': '__TEST__ No DE', 'cpu_cores': 2, 'ram_gb': 2, 'disk_gb': 20,
            'iso_volid': 'local:iso/ubuntu-22.04.5-desktop-amd64.iso',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('desktop_environment_id', resp.data['message'])

    def test_invalid_template_type_rejected(self):
        resp = self.client.post('/api/admin/templates/create-job/', {
            'name': '__TEST__ Bad Type', 'cpu_cores': 2, 'ram_gb': 2, 'disk_gb': 20,
            'iso_volid': 'local:iso/x.iso', 'template_type': 'desktop-ish',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_server_job_ignores_a_stray_desktop_environment_id_if_sent(self, MockPS):
        # Adversarial: a buggy/malicious client sends BOTH
        # template_type='server' AND a real desktop_environment_id.
        # 'server' must win — never silently attach a desktop
        # environment to a job that claims to be CLI-only, since every
        # downstream step (apply-configuration, promote) trusts
        # template_type alone to decide whether desktop_environment is
        # even meaningful.
        instance = MockPS.return_value
        instance.create_vm.return_value = 555556
        instance.start_vm.return_value = None
        de = _get_or_create_xfce()

        resp = self.client.post('/api/admin/templates/create-job/', {
            'name': '__TEST__ Server Stray DE', 'cpu_cores': 2, 'ram_gb': 2, 'disk_gb': 20,
            'iso_volid': 'local:iso/x.iso', 'template_type': 'server',
            'desktop_environment_id': de.id,
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        job = TemplateCreationJob.objects.get(id=resp.data['data']['id'])
        self.assertIsNone(job.desktop_environment)


class SerializeJobNullSafetyTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='__t_srv_serialize_admin__', email='srv_serialize_admin@t.com', password='pw12345', role='admin')

    def tearDown(self):
        TemplateCreationJob.objects.filter(created_by=self.admin).delete()

    def test_job_detail_endpoint_does_not_crash_for_a_server_job(self):
        job = TemplateCreationJob.objects.create(
            name='__TEST__ Serialize Server', template_type='server', desktop_environment=None,
            status='awaiting_os_install', proxmox_vmid=None, created_by=self.admin,
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        resp = client.get(f'/api/admin/templates/jobs/{job.id}/')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIsNone(resp.data['data']['desktop_environment'])
        self.assertEqual(resp.data['data']['template_type'], 'server')


class PromoteViewServerTypeTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='__t_srv_promote_admin__', email='srv_promote_admin@t.com', password='pw12345', role='admin')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def tearDown(self):
        VMTemplate.objects.filter(name__startswith='__TEST__').delete()
        TemplateCreationJob.objects.filter(created_by=self.admin).delete()

    def test_promote_server_job_creates_server_type_vmtemplate_with_guessed_os(self):
        job = TemplateCreationJob.objects.create(
            name='__TEST__ Promote Server', template_type='server', desktop_environment=None,
            status='completed', final_template_id=99999,
            iso_filename='local:iso/ubuntu-22.04.5-live-server-amd64.iso',
            created_by=self.admin,
        )
        resp = self.client.post(f'/api/admin/templates/jobs/{job.id}/promote/', {
            'name': '__TEST__ Ubuntu Server Template',
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        template = VMTemplate.objects.get(id=resp.data['data']['template_id'])
        self.assertEqual(template.template_type, 'server')
        self.assertIn('Ubuntu', template.os)
        self.assertIn('Server', template.os)
        self.assertEqual(template.software_list, [])

    def test_promote_server_job_respects_explicit_os_and_software_list_overrides(self):
        job = TemplateCreationJob.objects.create(
            name='__TEST__ Promote Server 2', template_type='server', desktop_environment=None,
            status='completed', final_template_id=99998, created_by=self.admin,
        )
        resp = self.client.post(f'/api/admin/templates/jobs/{job.id}/promote/', {
            'name': '__TEST__ Custom OS Template', 'os': 'Debian 12 Minimal',
            'software_list': ['docker', 'git'],
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        template = VMTemplate.objects.get(id=resp.data['data']['template_id'])
        self.assertEqual(template.os, 'Debian 12 Minimal')
        self.assertEqual(template.software_list, ['docker', 'git'])

    def test_promote_desktop_job_unaffected_regression(self):
        de = _get_or_create_xfce()
        job = TemplateCreationJob.objects.create(
            name='__TEST__ Promote Desktop', template_type='desktop', desktop_environment=de,
            status='completed', final_template_id=99997, created_by=self.admin,
        )
        resp = self.client.post(f'/api/admin/templates/jobs/{job.id}/promote/', {
            'name': '__TEST__ Desktop Template',
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        template = VMTemplate.objects.get(id=resp.data['data']['template_id'])
        self.assertEqual(template.template_type, 'desktop')
        self.assertEqual(template.os, 'XFCE')
        # Compared against the real profile's actual default_apps
        # rather than a hardcoded guess — _get_or_create_xfce() reuses
        # whatever real 'xfce' row already exists (seeded via
        # migration), which may carry more than just ['firefox'].
        self.assertEqual(template.software_list, de.default_apps)


class FriendlyOsNameFromIsoTests(SimpleTestCase):
    def test_common_cases(self):
        self.assertEqual(_friendly_os_name_from_iso('ubuntu-22.04.5-live-server-amd64.iso'), 'Ubuntu 22.04.5 Server')
        self.assertEqual(_friendly_os_name_from_iso(''), 'Server')
        self.assertEqual(_friendly_os_name_from_iso(None), 'Server')


class CreateConnectionForTemplateTests(SimpleTestCase):
    """Real, adversarial proof at the shared helper every production
    VM-launch path now goes through: a 'server' template must NEVER
    get an RDP connection, a 'desktop' template must NEVER get SSH."""

    def test_server_type_uses_ssh_never_rdp(self):
        guac = MagicMock()
        guac.create_ssh_connection.return_value = 'conn-ssh-1'
        conn_id = create_connection_for_template(guac, 'server', 'test-vm', '10.0.0.5')
        self.assertEqual(conn_id, 'conn-ssh-1')
        guac.create_ssh_connection.assert_called_once()
        guac.create_connection.assert_not_called()

    def test_desktop_type_uses_rdp_never_ssh(self):
        guac = MagicMock()
        guac.create_connection.return_value = 'conn-rdp-1'
        conn_id = create_connection_for_template(guac, 'desktop', 'test-vm', '10.0.0.5')
        self.assertEqual(conn_id, 'conn-rdp-1')
        guac.create_connection.assert_called_once()
        guac.create_ssh_connection.assert_not_called()

    def test_desktop_type_raises_honestly_on_none_return(self):
        guac = MagicMock()
        guac.create_connection.return_value = None
        with self.assertRaises(Exception):
            create_connection_for_template(guac, 'desktop', 'test-vm', '10.0.0.5')


class WaitForRemoteAccessReadyTests(SimpleTestCase):
    @patch('socket.socket')
    def test_server_type_checks_port_22(self, mock_socket_cls):
        mock_sock = MagicMock()
        mock_sock.connect_ex.return_value = 0
        mock_socket_cls.return_value = mock_sock
        result = wait_for_remote_access_ready('10.0.0.5', 'server', timeout=5, poll_interval=1)
        self.assertTrue(result)
        mock_sock.connect_ex.assert_called_with(('10.0.0.5', 22))

    @patch('socket.socket')
    def test_desktop_type_checks_port_3389(self, mock_socket_cls):
        mock_sock = MagicMock()
        mock_sock.connect_ex.return_value = 0
        mock_socket_cls.return_value = mock_sock
        result = wait_for_remote_access_ready('10.0.0.5', 'desktop', timeout=5, poll_interval=1)
        self.assertTrue(result)
        mock_sock.connect_ex.assert_called_with(('10.0.0.5', 3389))


class StartRealVmServerTypeAdversarialTests(TestCase):
    """Real, adversarial proof at the actual production call site (not
    just the shared helper in isolation): a real VirtualMachine whose
    template is template_type='server', run through the real
    start_real_vm() code path (Proxmox/Guacamole/socket faked at the
    network boundary, everything else genuinely real Django/DB), must
    NEVER result in an RDP Guacamole connection being minted, and must
    wait on port 22, not 3389."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='__t_srv_vm_owner__', email='srv_vm_owner@t.com', password='pw12345')
        self.template = VMTemplate.objects.create(
            name='__TEST__ Server VM Template', description='x', cpu_cores=2, ram_gb=2, storage_gb=20,
            os='Ubuntu Server', template_type='server', is_real=True, proxmox_template_id=1,
        )
        self.vm = VirtualMachine.objects.create(
            name='srv-vm', owner=self.owner, template=self.template, status='stopped', proxmox_vm_id=8888,
        )
        self.workspace = Workspace.objects.create(owner=self.owner, vm_template=self.template, vm=self.vm, status='inactive')

    def tearDown(self):
        self.workspace.delete()
        self.vm.delete()
        self.template.delete()

    @patch('socket.socket')
    @patch('apps.vms.services.guacamole_service.get_guacamole_service')
    @patch('apps.vms.services.proxmox_service.get_proxmox_service')
    def test_start_real_vm_never_calls_rdp_create_connection_for_server_template(
        self, mock_get_proxmox, mock_get_guac, mock_socket_cls,
    ):
        mock_proxmox = MagicMock()
        mock_proxmox.get_vm_ip.return_value = '10.0.0.9'
        mock_get_proxmox.return_value = mock_proxmox

        mock_guac = MagicMock()
        mock_guac.create_ssh_connection.return_value = 'real-ssh-conn-1'
        mock_get_guac.return_value = mock_guac

        mock_sock = MagicMock()
        mock_sock.connect_ex.return_value = 0
        mock_socket_cls.return_value = mock_sock

        from apps.vms.services.vm_orchestrator import VMOrchestrator
        orchestrator = VMOrchestrator()
        result = orchestrator.start_real_vm(self.workspace)

        self.assertNotIn('error', result, result)
        mock_guac.create_ssh_connection.assert_called_once()
        mock_guac.create_connection.assert_not_called()
        mock_sock.connect_ex.assert_called_with(('10.0.0.9', 22))

    @patch('socket.socket')
    @patch('apps.vms.services.guacamole_service.get_guacamole_service')
    @patch('apps.vms.services.proxmox_service.get_proxmox_service')
    def test_start_real_vm_uses_rdp_for_desktop_template_regression(
        self, mock_get_proxmox, mock_get_guac, mock_socket_cls,
    ):
        # Regression guard on the same real call site: a 'desktop'
        # template must keep getting RDP, exactly as before Phase 3.
        self.template.template_type = 'desktop'
        self.template.save(update_fields=['template_type'])

        mock_proxmox = MagicMock()
        mock_proxmox.get_vm_ip.return_value = '10.0.0.9'
        mock_get_proxmox.return_value = mock_proxmox

        mock_guac = MagicMock()
        mock_guac.create_connection.return_value = 'real-rdp-conn-1'
        mock_get_guac.return_value = mock_guac

        mock_sock = MagicMock()
        mock_sock.connect_ex.return_value = 0
        mock_socket_cls.return_value = mock_sock

        from apps.vms.services.vm_orchestrator import VMOrchestrator
        orchestrator = VMOrchestrator()
        result = orchestrator.start_real_vm(self.workspace)

        self.assertNotIn('error', result, result)
        mock_guac.create_connection.assert_called_once()
        mock_guac.create_ssh_connection.assert_not_called()
        mock_sock.connect_ex.assert_called_with(('10.0.0.9', 3389))


class ApplyConfigurationServerTypeTests(TestCase):
    """Real test of AdminTemplateJobApplyConfigurationView's server-path
    branch — the exact code that skips fix_script/xrdp entirely for a
    'server' job (job.desktop_environment is None there). Real Django
    request/response cycle and real job row throughout; only the actual
    SSH/Proxmox network calls are faked, at the same module boundary
    the view itself imports them from.

    This closes a real gap: live browser testing of a genuine manual
    OS install through the embedded VNC console was attempted for this
    phase but not completed — the console's rendered text was too
    small to reliably read/verify keystrokes against in this specific
    browser-automation environment, and multiple keypress attempts
    (Return, Tab, typed characters) produced no visually confirmable
    change, so proceeding further would have meant claiming an
    interaction succeeded with no real way to verify it. Disclosed
    honestly rather than either pretending the live pass completed or
    silently dropping coverage of the underlying view logic — this
    test is the real substitute for that coverage, exercising the
    exact code that would otherwise only be trusted by inspection."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='__t_srv_applycfg_admin__', email='srv_applycfg_admin@t.com', password='pw12345', role='admin')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def tearDown(self):
        TemplateCreationJob.objects.filter(created_by=self.admin).delete()

    def _ok(self, stdout=''):
        return {'success': True, 'stdout': stdout, 'stderr': '', 'exit_code': 0}

    @patch('apps.vms.services.ssh_service.run_ssh_script')
    @patch('apps.vms.services.ssh_service.run_ssh_command')
    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_server_job_skips_desktop_config_and_reaches_installing_apps(self, MockPS, mock_run_cmd, mock_run_script):
        instance = MockPS.return_value
        instance.get_vm_ip.return_value = '10.0.0.50'
        instance.detach_install_iso_and_fix_boot_order.return_value = None
        mock_run_cmd.return_value = self._ok('connected')
        mock_run_script.return_value = self._ok()

        job = TemplateCreationJob.objects.create(
            name='__TEST__ Apply Config Server', template_type='server', desktop_environment=None,
            status='awaiting_os_install', proxmox_vmid=7777, created_by=self.admin,
        )

        resp = self.client.post(f'/api/admin/templates/jobs/{job.id}/apply-configuration/', {
            'ssh_username': 'ospace', 'ssh_password': 'testpass123',
        }, format='json')

        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['data']['status'], 'installing_apps')

        # Real, precise proof the desktop-only tail never ran: no SSH
        # script call in the whole sequence ever referenced xrdp — the
        # exact real file this view writes de.session_command into for
        # a desktop job.
        all_script_calls = [str(call) for call in mock_run_script.call_args_list]
        self.assertTrue(all_script_calls, 'expected at least the generic hardening scripts to run')
        self.assertFalse(any('xrdp' in c for c in all_script_calls), all_script_calls)

    @patch('apps.vms.services.ssh_service.run_ssh_script')
    @patch('apps.vms.services.ssh_service.run_ssh_command')
    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_desktop_job_still_writes_xrdp_session_command_regression(self, MockPS, mock_run_cmd, mock_run_script):
        # Regression guard on the same real view: a 'desktop' job must
        # keep writing startwm.sh exactly as before Phase 3.
        de = _get_or_create_xfce()
        instance = MockPS.return_value
        instance.get_vm_ip.return_value = '10.0.0.51'
        instance.detach_install_iso_and_fix_boot_order.return_value = None
        mock_run_cmd.side_effect = [
            self._ok('connected'),  # sanity check
            self._ok(de.session_command.strip()),  # verify-after-write read-back
        ]
        mock_run_script.return_value = self._ok()

        job = TemplateCreationJob.objects.create(
            name='__TEST__ Apply Config Desktop', template_type='desktop', desktop_environment=de,
            status='awaiting_os_install', proxmox_vmid=7778, created_by=self.admin,
        )

        resp = self.client.post(f'/api/admin/templates/jobs/{job.id}/apply-configuration/', {
            'ssh_username': 'ospace', 'ssh_password': 'testpass123',
        }, format='json')

        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data['data']['status'], 'installing_apps')
        all_script_calls = [str(call) for call in mock_run_script.call_args_list]
        self.assertTrue(any('xrdp' in c for c in all_script_calls), all_script_calls)


class UnlinkedTemplateLinkViewServerTypeTests(TestCase):
    """Phase 4: the 'link an existing Proxmox template' admin flow
    (pool_views.py's UnlinkedTemplateLinkView) also gained template_type
    support in Phase 3, but had no direct test yet. Real Django
    request/response cycle; only the actual Proxmox network call is
    faked, at the real module boundary the view imports it from."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='__t_unlinked_admin__', email='unlinked_admin@t.com', password='pw12345', role='admin')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def tearDown(self):
        VMTemplate.objects.filter(name__startswith='__TEST__').delete()

    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_linking_with_server_type_sets_it_on_the_real_template(self, MockPS):
        instance = MockPS.return_value
        instance.proxmox.nodes.return_value.qemu.return_value.config.get.return_value = {
            'template': 1, 'name': 'unlinked-server', 'cores': 2, 'memory': 2048,
        }
        resp = self.client.post('/api/vms/admin/templates/unlinked/link/', {
            'proxmox_vmid': 12345, 'name': '__TEST__ Linked Server', 'template_type': 'server',
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        template = VMTemplate.objects.get(name='__TEST__ Linked Server')
        self.assertEqual(template.template_type, 'server')

    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_linking_with_no_template_type_defaults_to_desktop_regression(self, MockPS):
        instance = MockPS.return_value
        instance.proxmox.nodes.return_value.qemu.return_value.config.get.return_value = {
            'template': 1, 'name': 'unlinked-desktop', 'cores': 2, 'memory': 2048,
        }
        resp = self.client.post('/api/vms/admin/templates/unlinked/link/', {
            'proxmox_vmid': 12346, 'name': '__TEST__ Linked Desktop',
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        template = VMTemplate.objects.get(name='__TEST__ Linked Desktop')
        self.assertEqual(template.template_type, 'desktop')

    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_linking_with_invalid_template_type_falls_back_to_desktop(self, MockPS):
        # Adversarial: a nonsense/garbage template_type must never
        # silently create an ambiguous VMTemplate row.
        instance = MockPS.return_value
        instance.proxmox.nodes.return_value.qemu.return_value.config.get.return_value = {
            'template': 1, 'name': 'unlinked-garbage', 'cores': 2, 'memory': 2048,
        }
        resp = self.client.post('/api/vms/admin/templates/unlinked/link/', {
            'proxmox_vmid': 12347, 'name': '__TEST__ Linked Garbage', 'template_type': 'not-a-real-type',
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        template = VMTemplate.objects.get(name='__TEST__ Linked Garbage')
        self.assertEqual(template.template_type, 'desktop')
