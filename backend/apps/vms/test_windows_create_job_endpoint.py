"""
Windows template support — Phase 2.1, wired into the real create-job
endpoint (not just the ProxmoxService method in isolation — see
test_windows_vm_creation.py for that).

Real, direct proof AdminTemplateJobCreateView genuinely routes a
'windows' job to create_windows_vm() (the Windows-appropriate hardware
profile), never through create_vm() (the Linux path), and never
requires a desktop_environment_id — matching the existing 'server'
path's same real design.
"""
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.vms.models import TemplateCreationJob


class WindowsCreateJobEndpointTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='__t_win_create_admin__', email='win_create_admin@t.com',
            password='pw12345', role='admin',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def tearDown(self):
        TemplateCreationJob.objects.filter(name__startswith='__TEST__').delete()

    @patch('apps.vms.services.proxmox_service.ProxmoxService')
    def test_windows_job_routes_to_the_windows_hardware_profile_not_the_linux_one(self, MockPS):
        ps_instance = MockPS.return_value
        ps_instance.create_windows_vm.return_value = 88880
        ps_instance.start_vm.return_value = None

        resp = self.client.post('/api/admin/templates/create-job/', {
            'name': '__TEST__ Windows Server 2022',
            'cpu_cores': 4, 'ram_gb': 8, 'disk_gb': 60,
            'iso_volid': 'local:iso/windows-server-2022-eval.iso',
            'template_type': 'windows',
        }, format='json')

        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data['data']['template_type'], 'windows')
        ps_instance.create_windows_vm.assert_called_once()
        ps_instance.create_vm.assert_not_called()

        job = TemplateCreationJob.objects.get(name='__TEST__ Windows Server 2022')
        self.assertIsNone(job.desktop_environment)
        self.assertEqual(job.proxmox_vmid, 88880)

    def test_windows_job_never_requires_a_desktop_environment_id(self):
        with patch('apps.vms.services.proxmox_service.ProxmoxService') as MockPS:
            MockPS.return_value.create_windows_vm.return_value = 88881
            MockPS.return_value.start_vm.return_value = None

            resp = self.client.post('/api/admin/templates/create-job/', {
                'name': '__TEST__ Windows No DE',
                'cpu_cores': 4, 'ram_gb': 8, 'disk_gb': 60,
                'iso_volid': 'local:iso/windows-server-2022-eval.iso',
                'template_type': 'windows',
                # deliberately no desktop_environment_id
            }, format='json')

        self.assertEqual(resp.status_code, 201, resp.content)

    def test_rejects_an_unknown_template_type(self):
        resp = self.client.post('/api/admin/templates/create-job/', {
            'name': '__TEST__ Bad Type',
            'cpu_cores': 2, 'ram_gb': 4, 'disk_gb': 20,
            'iso_volid': 'local:iso/whatever.iso',
            'template_type': 'macos',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(TemplateCreationJob.objects.filter(name='__TEST__ Bad Type').exists())
