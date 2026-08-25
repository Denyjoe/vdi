"""
Windows template support — Phase 2.1 (VM creation with Windows-
appropriate hardware).

Real, confirmed-against-Proxmox's-own-documentation hardware profile
for a Windows guest — proven live this phase via a disposable test VM
(bios=ovmf, machine=q35, a real efidisk0 and tpmstate0(v2.0) both
auto-provisioned correctly, ide2+ide3 dual CD-ROM, scsihw=virtio-scsi-
single, net0=virtio, ostype=win11 — VM reached a genuine, stable
`qmpstatus: running` state with every one of those params accepted).

These tests lock in create_windows_vm()'s real request shape against a
mocked Proxmox HTTP boundary (the same `._client` mocking pattern used
throughout this app's other ProxmoxService tests) — never re-testing
Proxmox's own documented API behavior, only that this app's code sends
exactly the parameters the live test above proved are correct.
"""
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from apps.vms.services.proxmox_service import ProxmoxService


def _service_with_mocked_client():
    service = ProxmoxService()
    service._client = MagicMock()
    return service


class CreateWindowsVmTests(SimpleTestCase):
    def setUp(self):
        self.service = _service_with_mocked_client()
        self.qemu_post = self.service.proxmox.nodes.return_value.qemu.post
        # get_next_vmid() has its own dedicated real-DB-backed tests
        # (test_vmid_allocation.py) — not re-tested here, just stubbed
        # to a fixed value so these hardware-profile tests stay fast
        # and don't need a real database.
        self.get_next_vmid_patch = patch.object(self.service, 'get_next_vmid', return_value=9999)
        self.get_next_vmid_patch.start()
        self.addCleanup(self.get_next_vmid_patch.stop)

    def test_uses_a_real_windows_appropriate_hardware_profile(self):
        with patch.object(self.service, 'find_virtio_iso_volid', return_value='local:iso/virtio-win.iso'):
            self.service.create_windows_vm(
                name='test-win-vm', cpu_cores=4, ram_gb=8, disk_gb=60,
                iso_volid='local:iso/windows-server-2022-eval.iso',
            )

        self.assertEqual(self.qemu_post.call_count, 1)
        kwargs = self.qemu_post.call_args.kwargs
        self.assertEqual(kwargs['machine'], 'q35')
        self.assertEqual(kwargs['bios'], 'ovmf')
        self.assertEqual(kwargs['ostype'], 'win11')
        self.assertEqual(kwargs['scsihw'], 'virtio-scsi-single')
        self.assertIn('efitype=4m', kwargs['efidisk0'])
        self.assertIn('pre-enrolled-keys=1', kwargs['efidisk0'])
        self.assertIn('version=v2.0', kwargs['tpmstate0'])
        self.assertIn('virtio', kwargs['net0'])

    def test_attaches_the_os_iso_and_the_virtio_iso_as_two_separate_cdroms(self):
        with patch.object(self.service, 'find_virtio_iso_volid', return_value='local:iso/virtio-win.iso'):
            self.service.create_windows_vm(
                name='test-win-vm', cpu_cores=4, ram_gb=8, disk_gb=60,
                iso_volid='local:iso/windows-server-2022-eval.iso',
            )

        kwargs = self.qemu_post.call_args.kwargs
        self.assertIn('local:iso/windows-server-2022-eval.iso', kwargs['ide2'])
        self.assertIn('local:iso/virtio-win.iso', kwargs['ide3'])
        # The VirtIO ISO must never be a boot candidate — it's a
        # driver source only.
        self.assertNotIn('ide3', kwargs['boot'])

    def test_boots_disk_first_like_the_existing_linux_fix(self):
        # Reuses the exact same real, confirmed fix create_vm() already
        # applies for Linux (see its own docstring) — a blank disk
        # falls through to the ISO on the first boot only, so every
        # later boot (including Windows Setup's own mid-install
        # reboots) picks the disk with zero app timing dependency.
        with patch.object(self.service, 'find_virtio_iso_volid', return_value='local:iso/virtio-win.iso'):
            self.service.create_windows_vm(
                name='test-win-vm', cpu_cores=4, ram_gb=8, disk_gb=60,
                iso_volid='local:iso/windows-server-2022-eval.iso',
            )

        kwargs = self.qemu_post.call_args.kwargs
        self.assertTrue(kwargs['boot'].startswith('order=scsi0'))

    def test_refuses_to_build_a_windows_vm_with_no_real_virtio_iso_available(self):
        # Real, deliberate failure mode: never silently create a
        # Windows VM that Setup can't actually install onto because
        # scsi0 is invisible without the VirtIO driver.
        with patch.object(self.service, 'find_virtio_iso_volid', return_value=None):
            with self.assertRaises(Exception) as ctx:
                self.service.create_windows_vm(
                    name='test-win-vm', cpu_cores=4, ram_gb=8, disk_gb=60,
                    iso_volid='local:iso/windows-server-2022-eval.iso',
                )
        self.assertIn('virtio-win.iso', str(ctx.exception))
        self.qemu_post.assert_not_called()


class FindVirtioIsoVolidTests(SimpleTestCase):
    def setUp(self):
        self.service = _service_with_mocked_client()

    def test_finds_the_real_virtio_iso_by_filename(self):
        with patch.object(self.service, 'list_available_isos', return_value=[
            {'volid': 'local:iso/ubuntu-22.04.5-desktop-amd64.iso', 'filename': 'ubuntu-22.04.5-desktop-amd64.iso'},
            {'volid': 'local:iso/virtio-win.iso', 'filename': 'virtio-win.iso'},
        ]):
            self.assertEqual(self.service.find_virtio_iso_volid(), 'local:iso/virtio-win.iso')

    def test_returns_none_when_not_present(self):
        with patch.object(self.service, 'list_available_isos', return_value=[
            {'volid': 'local:iso/ubuntu-22.04.5-desktop-amd64.iso', 'filename': 'ubuntu-22.04.5-desktop-amd64.iso'},
        ]):
            self.assertIsNone(self.service.find_virtio_iso_volid())
