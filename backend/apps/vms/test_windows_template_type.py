"""
Windows template support — Phase 1 (data model).

Real, permanent regression coverage for the new 'windows' template_type
choice on both TemplateCreationJob and VMTemplate. Windows is a genuine
THIRD path through the wizard (alongside 'desktop' and 'server'), not a
variant of either — these tests exist so a future refactor can't
silently narrow the choices back down to two without a test failing.

Real VirtIO-ISO-download and dual-CD-ROM (ide2 + ide3) capability were
confirmed this phase via a live, disposable Proxmox VM and a real
download-url task against the official virtio-win.iso — not re-proven
here as mocked unit tests, since that would just be re-asserting
Proxmox's own documented API behavior rather than testing code this
app wrote. The real, live evidence for those is in the Phase 1 report.
"""
from django.test import TestCase

from apps.users.models import User
from apps.vms.models import TemplateCreationJob, VMTemplate


class WindowsTemplateTypeChoiceTests(TestCase):
    def test_template_creation_job_accepts_windows_as_a_real_third_choice(self):
        choice_values = [c[0] for c in TemplateCreationJob.TEMPLATE_TYPE_CHOICES]
        self.assertEqual(choice_values, ['desktop', 'server', 'windows'])

    def test_vmtemplate_accepts_windows_as_a_real_third_choice(self):
        choice_values = [c[0] for c in VMTemplate._meta.get_field('template_type').choices]
        self.assertEqual(choice_values, ['desktop', 'server', 'windows'])

    def test_template_creation_job_windows_value_survives_a_real_db_round_trip(self):
        admin = User.objects.create_user(
            username='__t_win_choice_admin__', email='win_choice_admin@t.com',
            password='pw12345', role='admin',
        )
        job = TemplateCreationJob.objects.create(
            name='__TEST__ windows choice roundtrip', template_type='windows',
            status='vm_creating', created_by=admin,
        )
        job.refresh_from_db()
        self.assertEqual(job.template_type, 'windows')

    def test_vmtemplate_windows_value_survives_a_real_db_round_trip(self):
        t = VMTemplate.objects.create(
            name='__TEST__ Windows Template', os='Windows Server 2022',
            template_type='windows', cpu_cores=2, ram_gb=4, storage_gb=40,
        )
        t.refresh_from_db()
        self.assertEqual(t.template_type, 'windows')
