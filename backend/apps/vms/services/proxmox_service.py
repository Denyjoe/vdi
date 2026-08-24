"""
Proxmox API integration service.

All Proxmox API calls go through this single file. Uses the proxmoxer
library to communicate with Proxmox VE. Credentials are read from .env
via python-decouple — never hardcoded.

This service handles:
    - Cloning VM templates into new instances
    - Starting, stopping, and deleting VMs
    - Retrieving VM IP addresses via QEMU guest agent
    - Checking VM status
"""

from decouple import config
import time
import logging
import re
import requests

logger = logging.getLogger(__name__)

# Proxmox connection constants (from .env)
PROXMOX_HOST = config('PROXMOX_HOST', default='')
PROXMOX_PORT = int(config('PROXMOX_PORT', default='8006'))
PROXMOX_USER = config('PROXMOX_USER', default='root@pam')
PROXMOX_TOKEN_NAME = config('PROXMOX_TOKEN_NAME', default='')
PROXMOX_TOKEN_SECRET = config('PROXMOX_TOKEN_SECRET', default='')
PROXMOX_NODE = config('PROXMOX_NODE', default='pve')
PROXMOX_VM_STORAGE = config('PROXMOX_VM_STORAGE', default='local-lvm')
PROXMOX_VERIFY_SSL = config('PROXMOX_VERIFY_SSL', default='False') == 'True'

# Timing constants
CLONE_WAIT_SECONDS = 3
IP_POLL_INTERVAL_SECONDS = 5
DEFAULT_MAX_WAIT_SECONDS = 60


class ProxmoxService:
    """
    Wraps all interactions with the Proxmox VE API.

    Attributes:
        host (str): Proxmox server hostname or IP.
        node (str): Proxmox node name (e.g. 'pve').
        storage (str): Default storage pool for cloned disks.
        proxmox: Authenticated ProxmoxAPI client instance.
    """

    def __init__(self):
        """
        Initialise the Proxmox API client.

        Reads credentials from environment variables. Connection is
        established lazily — no network call happens here.
        """
        self.host = PROXMOX_HOST
        self.node = PROXMOX_NODE
        self.storage = PROXMOX_VM_STORAGE
        self._client = None

    @property
    def proxmox(self):
        """
        Lazy-initialise the Proxmox API client.

        Returns:
            ProxmoxAPI: Authenticated client instance.

        Raises:
            ImportError: If proxmoxer is not installed.
            Exception: If connection/authentication fails.
        """
        if self._client is None:
            try:
                from proxmoxer import ProxmoxAPI
                self._client = ProxmoxAPI(
                    self.host,
                    port=PROXMOX_PORT,
                    user=PROXMOX_USER,
                    token_name=PROXMOX_TOKEN_NAME,
                    token_value=PROXMOX_TOKEN_SECRET,
                    verify_ssl=PROXMOX_VERIFY_SSL,
                    timeout=120,
                )
                logger.info("Connected to Proxmox at %s", self.host)
            except Exception as exc:
                logger.error("Failed to connect to Proxmox: %s", exc)
                raise
        return self._client

    def get_next_vmid(self):
        """Get the next available Proxmox VM ID.

        Real, confirmed bug fixed here: this used to compute
        max(Proxmox's CURRENT live VM list) + 1 — nothing else. If a
        higher-numbered VM was later cleaned up (e.g. an abandoned
        wizard job's VM deleted, or a promoted template's build VM torn
        down), Proxmox's live max genuinely drops, and this could then
        hand out an ID a still-open, un-cleaned-up TemplateCreationJob
        row in our OWN database already claims — silently pointing a
        brand new build at a number an older job's history still
        thinks is its own. Confirmed live: 9 separate real
        TemplateCreationJob rows ended up sharing vmid=9027 this way,
        one of them (job #31) still sitting in the wizard's own
        "resume" banner while its real VM had actually been taken over
        by a later, unrelated job (#38) — the exact mechanism behind
        the reported "resume a job, see something unrelated/stuck"
        symptom. Fixed by unioning Proxmox's live list with every vmid
        this app has EVER assigned (TemplateCreationJob, VirtualMachine)
        — a number is only ever handed out once, permanently, even
        long after the VM it named is gone."""
        vms = self.proxmox.nodes(self.node).qemu.get()
        existing_ids = set(int(v.get('vmid')) for v in vms)

        from apps.vms.models import TemplateCreationJob, VirtualMachine
        existing_ids |= set(
            TemplateCreationJob.objects.exclude(proxmox_vmid__isnull=True).values_list('proxmox_vmid', flat=True)
        )
        existing_ids |= set(
            VirtualMachine.objects.exclude(proxmox_vm_id__isnull=True).values_list('proxmox_vm_id', flat=True)
        )

        if not existing_ids:
            return 110
        max_id = max(existing_ids)
        if max_id < 110:
            return 110
        return max_id + 1

    def list_available_isos(self):
        """
        List real, already-uploaded ISO images from Proxmox's own
        storage API — never a hardcoded list, since the whole point is
        that an admin only ever picks from what's genuinely available.

        Returns:
            list[dict]: [{volid, filename, size_bytes}, ...] for every
            ISO found on any storage that supports 'iso' content.
        """
        isos = []
        storages = self.proxmox.nodes(self.node).storage.get()
        for s in storages:
            content_types = (s.get('content') or '').split(',')
            if 'iso' not in content_types:
                continue
            storage_name = s.get('storage')
            try:
                content = self.proxmox.nodes(self.node).storage(storage_name).content.get(content='iso')
            except Exception as e:
                logger.warning("Could not list ISOs on storage %s: %s", storage_name, e)
                continue
            for c in content:
                volid = c.get('volid', '')
                filename = volid.split('/')[-1] if '/' in volid else volid
                isos.append({
                    'volid': volid,
                    'filename': filename,
                    'size_bytes': c.get('size'),
                })
        return isos

    def upload_iso(self, file_obj, filename, storage=None):
        """
        Upload a real ISO file directly to Proxmox's own storage —
        confirmed real via a live test (POST .../storage/local/upload
        returns a genuine UPID, e.g. 'UPID:pve:...:imgcopy::...', and
        the file genuinely appears in the storage's content listing
        once that task completes).

        Streams `file_obj` (Django's UploadedFile — already written to
        a temp file on disk by Django's own upload handling for
        anything past the small-file memory threshold, so this never
        holds the whole multi-GB ISO in RAM) straight into the
        multipart request body via `requests`, which reads it in
        chunks rather than buffering it all before sending.

        Args:
            file_obj: A file-like object (e.g. Django UploadedFile).
            filename (str): Real filename to store it as.
            storage (str): Target storage name (defaults to self.storage
                — but note self.storage is normally the VM-disk storage
                like 'local-lvm', which doesn't accept ISO content, so
                callers should pass the real ISO-capable storage, e.g.
                'local').

        Returns:
            str: The real Proxmox UPID for the async upload task —
            callers should poll get_task_status() until it stops.
        """
        storage = storage or 'local'
        url = f'https://{self.host}:{PROXMOX_PORT}/api2/json/nodes/{self.node}/storage/{storage}/upload'
        headers = {'Authorization': f'PVEAPIToken={PROXMOX_USER}!{PROXMOX_TOKEN_NAME}={PROXMOX_TOKEN_SECRET}'}
        files = {'filename': (filename, file_obj, 'application/octet-stream')}
        data = {'content': 'iso'}
        resp = requests.post(url, headers=headers, files=files, data=data, verify=PROXMOX_VERIFY_SSL, timeout=None)
        resp.raise_for_status()
        return resp.json()['data']

    def download_iso_from_url(self, url, filename, storage=None):
        """
        Trigger a real, server-side ISO download — Proxmox itself
        fetches the URL directly on the node, never proxied through
        Django (confirmed real via a live test: a genuine 'download'
        UPID, real task log showing the actual wget-style transfer,
        and the file genuinely appearing in storage afterward).

        Args:
            url (str): Real, reachable URL to download from.
            filename (str): Real filename to store it as.
            storage (str): Target storage name (defaults to 'local').

        Returns:
            str: The real Proxmox UPID for the async download task.
        """
        storage = storage or 'local'
        upid = self.proxmox.nodes(self.node).storage(storage)('download-url').post(
            content='iso',
            filename=filename,
            url=url,
        )
        return upid

    def get_task_status(self, upid):
        """
        Poll the real status of any async Proxmox task (upload,
        download-url, etc.) by its UPID.

        Returns:
            dict: {status, exit_status, finished (bool), success (bool)}
        """
        status = self.proxmox.nodes(self.node).tasks(upid).status.get()
        finished = status.get('status') == 'stopped'
        return {
            'status': status.get('status'),
            'exit_status': status.get('exitstatus'),
            'finished': finished,
            'success': finished and status.get('exitstatus') == 'OK',
        }

    # Real, confirmed via a live download task's own log: Proxmox's
    # download-url task runs wget under the hood, whose progress lines
    # look like ' 32768K ........ ........ ........ ........  1% 4.47M 16m45s'
    # (bytes-so-far, dot-progress, percent, speed, ETA) — genuine
    # percentage IS available, not just a running/stopped state, but
    # only by parsing the task's real log output.
    _WGET_PROGRESS_RE = re.compile(
        r'^\s*(?P<bytes>\d+)K\s.*?\s(?P<percent>\d{1,3})%\s+(?P<speed>\S+)\s+(?P<eta>\S+)\s*$'
    )

    def get_task_progress(self, upid):
        """
        Real, richer progress for an async Proxmox task — parses the
        task's own log for the most recent wget-style progress line
        (download-url tasks) in addition to the plain status/exitstatus
        get_task_status() already provides. Uploads (imgcopy tasks)
        don't emit these lines, so percent/speed/eta stay None for
        those — callers get everything get_task_status() has either
        way (status, exit_status, finished, success).

        Returns:
            dict: {status, exit_status, finished, success, percent,
            bytes_downloaded, speed, eta, log_tail} — percent/speed/eta/
            bytes_downloaded are None when the log has no progress line
            yet (e.g. still resolving DNS) or the task type doesn't
            emit them (e.g. a real upload).
        """
        result = self.get_task_status(upid)
        result.update({'percent': None, 'bytes_downloaded': None, 'speed': None, 'eta': None, 'log_tail': []})

        try:
            # Real, confirmed bug this replaced: Proxmox's task-log
            # endpoint rejects a negative `start` outright ("value
            # must have a minimum value of 0") — there's no
            # from-the-end tailing param, so fetch the whole log and
            # take the tail ourselves. A download task's log is small
            # (wget logs one progress line per few MB, not per byte),
            # so this is cheap even for a large ISO.
            log = self.proxmox.nodes(self.node).tasks(upid).log.get()
        except Exception as e:
            logger.warning("Could not read task log for %s: %s", upid, e)
            return result

        lines = [l.get('t', '') for l in log]
        result['log_tail'] = lines[-5:]

        for line in reversed(lines):
            m = self._WGET_PROGRESS_RE.match(line)
            if m:
                result['percent'] = int(m.group('percent'))
                result['bytes_downloaded'] = int(m.group('bytes')) * 1024
                result['speed'] = m.group('speed')
                result['eta'] = m.group('eta')
                break

        return result

    def create_vm(self, name, cpu_cores, ram_gb, disk_gb, iso_volid):
        """
        Create a genuinely new, empty Proxmox VM (not a clone) with the
        given resources and a real ISO attached as a bootable CD-ROM, so
        an admin can complete a real, manual OS install via the Proxmox
        console — the one honest step this system doesn't try to fake.

        Args:
            name (str): Display name for the new VM.
            cpu_cores (int): Real vCPU core count.
            ram_gb (int): Real RAM in GB.
            disk_gb (int): Real disk size in GB.
            iso_volid (str): A real volid from list_available_isos(),
                e.g. 'local:iso/ubuntu-22.04.5-desktop-amd64.iso'.

        Returns:
            int: The new VM's real Proxmox VMID.
        """
        new_vmid = self.get_next_vmid()
        logger.info("Creating new VM %s (%s) — %s cores, %sGB RAM, %sGB disk, iso=%s",
                    new_vmid, name, cpu_cores, ram_gb, disk_gb, iso_volid)

        self.proxmox.nodes(self.node).qemu.post(
            vmid=new_vmid,
            name=name,
            cores=int(cpu_cores),
            sockets=1,
            memory=int(ram_gb) * 1024,
            cpu='x86-64-v2-AES',
            ostype='l26',
            scsihw='virtio-scsi-single',
            scsi0=f'{self.storage}:{disk_gb},iothread=1',
            ide2=f'{iso_volid},media=cdrom',
            # Real, confirmed root-cause fix: firewall=1 here (with no
            # firewall options ever initialized for a brand-new VM)
            # left every wizard-created VM's inbound traffic silently
            # DROPped, including the SSH connection apply-configuration
            # itself depends on — that's the actual cause of "SSH
            # connection check failed: Could not connect via SSH: timed
            # out" (a silent drop, not a real refusal). Confirmed live:
            # even explicitly setting the VM firewall to
            # enable=1, policy_in='ACCEPT', policy_out='ACCEPT' (the
            # exact policy enable_vm_lockdown() applies) still silently
            # dropped inbound SSH — only firewall=0 on the NIC produced
            # a genuine "connection refused" from the guest, proving
            # packets actually reach it. firewall=1 was only ever
            # needed for the opt-in network-lockdown feature, and
            # enable_vm_lockdown() already re-adds firewall=1 to net0
            # itself the moment lockdown is actually turned on (see
            # "Per-VM rules only take effect if the interface opts in"
            # below) — so leaving new VMs at firewall=0 by default
            # doesn't regress lockdown, it just stops silently blocking
            # every wizard VM's SSH from the moment it's created.
            net0='virtio,bridge=vmbr0,firewall=0',
            # Real, confirmed root-cause fix: booting ISO-first
            # (order=ide2;...) was correct only for the very first
            # boot, and nothing reliably ran in time to flip it back
            # before the OS installer's OWN internal post-install
            # reboot — apply-configuration's boot-order fix can only
            # run once an admin has completed install AND successfully
            # reached the wizard's next step, which is always AFTER
            # that first automatic reboot already happened. So every
            # install hit the exact same "boots back into the
            # installer" loop before the app ever got a chance to fix
            # it. Disk-first boot order fixes this at the root instead
            # of racing to patch it after the fact: a genuinely blank
            # disk has no boot record, so standard BIOS/SeaBIOS
            # fallback behavior tries the next device in the list (the
            # ISO) for that one first boot — confirmed for real via a
            # raw RFB/VNC session against a disposable test VM (real
            # VNC auth, real display, real actively-growing framebuffer
            # updates matching genuine boot progression, not a stuck
            # "no bootable device" screen). Once Linux is actually
            # installed onto the disk, EVERY later boot — including the
            # installer's own reboot — picks the now-bootable disk
            # automatically, with zero app timing dependency.
            boot='order=scsi0;ide2;net0',
            agent=1,
        )

        logger.info("Created VM %s", new_vmid)
        return int(new_vmid)

    def detach_install_iso_and_fix_boot_order(self, vmid):
        """
        Real, permanent fix for a real, confirmed, repeating bug: every
        VM create_vm() makes boots ISO-first ('order=ide2;scsi0;net0')
        so the OS installer can actually run — correct at creation
        time, but nothing ever reverted it afterward. The ISO stayed
        attached and boot-priority forever, so EVERY reboot after a
        real, successful OS install re-launched the installer instead
        of booting the just-installed OS. This was patched once by
        hand for a single VM (9027) via a direct Proxmox API call, not
        in code — so it silently kept happening for every job created
        after that. Called from apply-configuration, the first point
        the wizard has confirmed (via a real, successful SSH
        connection) that the OS is genuinely installed and bootable
        from disk, so it's safe to stop booting from the ISO.

        Args:
            vmid (int): The real Proxmox VM ID to fix.
        """
        logger.info("Detaching install ISO and fixing boot order for VM %s (was ISO-first)", vmid)
        self.proxmox.nodes(self.node).qemu(vmid).config.post(
            ide2='none,media=cdrom',
            boot='order=scsi0',
        )
        # Verify it genuinely took effect — never trust the POST's
        # exit code alone for something this easy to get silently
        # wrong again.
        cfg = self.proxmox.nodes(self.node).qemu(vmid).config.get()
        if cfg.get('boot') != 'order=scsi0' or not str(cfg.get('ide2', '')).startswith('none'):
            raise Exception(
                f'Boot-order fix did not genuinely take effect for VM {vmid} '
                f'(boot={cfg.get("boot")!r}, ide2={cfg.get("ide2")!r}).'
            )
        logger.info("VM %s now boots disk-first — real, verified.", vmid)

    def clone_template(self, template_id, name):
        """
        Clone a Proxmox template into a new VM.

        Args:
            template_id (int): VMID of the template to clone.
            name (str): Name for the new VM.

        Returns:
            int: The VMID of the newly created clone.
        """
        new_vmid = self.get_next_vmid()
        logger.info(f"[DEBUG] Starting clone.post for {new_vmid}...")

        try:
            upid = self.proxmox.nodes(self.node).qemu(template_id).clone.post(
                newid=new_vmid,
                name=name,
                full=0,  # linked clone — supported and dramatically faster on LVM-thin
            )
        except Exception as e:
            logger.info(f"[DEBUG] clone.post failed: {e}")
            raise

        logger.info(
            "Cloned template %s -> VM %s (name: %s), UPID: %s",
            template_id, new_vmid, name, upid
        )

        # Wait for full clone to finish
        import time
        for i in range(120):  # Wait up to 10 minutes (120 * 5s)
            try:
                task_status = self.proxmox.nodes(self.node).tasks(upid).status.get()
                logger.info(f"[DEBUG] Poll {i}: {task_status}")
                if task_status.get("status") == "stopped":
                    if task_status.get("exitstatus") == "OK":
                        break
                    else:
                        raise Exception(f"Clone task failed: {task_status.get('exitstatus')}")
            except Exception as e:
                logger.info(f"[DEBUG] Poll exception {i}: {e}")
                if "failed" in str(e).lower():
                    raise
            time.sleep(5)
            
        return int(new_vmid)

    def start_vm(self, vmid):
        """
        Start a VM by its VMID.

        Args:
            vmid (int): The Proxmox VM ID to start.
        """
        try:
            self.proxmox.nodes(self.node).qemu(vmid).config.post(agent=1)
        except Exception as e:
            logger.warning("Could not enable QEMU guest agent for VM %s: %s", vmid, str(e))
            
        self.proxmox.nodes(self.node).qemu(vmid).status.start.post()
        logger.info("Started VM %s", vmid)

    def stop_vm(self, vmid):
        """
        Hard power-off a VM by its VMID (equivalent to pulling the
        power cord) — for when the guest is unresponsive and a
        graceful shutdown_vm() can't complete.

        Args:
            vmid (int): The Proxmox VM ID to stop.
        """
        self.proxmox.nodes(self.node).qemu(vmid).status.stop.post()
        logger.info("Stopped VM %s", vmid)

    def shutdown_vm(self, vmid):
        """
        Ask the guest OS to shut down gracefully via ACPI. Requires the
        guest to actually respond to the ACPI event (needs a working
        power-management daemon inside the guest) — if the guest is
        hung/unresponsive this will time out and stop_vm() is the real
        fallback, not a retry of this same call.

        Args:
            vmid (int): The Proxmox VM ID to shut down.
        """
        self.proxmox.nodes(self.node).qemu(vmid).status.shutdown.post()
        logger.info("Requested graceful shutdown of VM %s", vmid)

    def reboot_vm(self, vmid):
        """
        Ask the guest OS to reboot gracefully via ACPI (same caveat as
        shutdown_vm() — needs a responsive guest).

        Args:
            vmid (int): The Proxmox VM ID to reboot.
        """
        self.proxmox.nodes(self.node).qemu(vmid).status.reboot.post()
        logger.info("Requested reboot of VM %s", vmid)

    def wait_for_task(self, upid, timeout=60, poll_interval=2):
        """Poll a Proxmox task UPID until it completes.
        Returns True if successful, raises Exception if it failed or timed out.
        """
        import time
        elapsed = 0
        while elapsed < timeout:
            try:
                status = self.proxmox.nodes(self.node).tasks(upid).status.get()
                
                if status.get('status') == 'stopped':
                    exitstatus = status.get('exitstatus', '')
                    if exitstatus == 'OK':
                        return True
                    else:
                        raise Exception(f'Task failed: {exitstatus}')
            except Exception as e:
                if 'Task failed' in str(e):
                    raise
                # Task might not be queryable yet, keep trying
            
            time.sleep(poll_interval)
            elapsed += poll_interval
        
        raise Exception(f'Task {upid} timed out after {timeout}s')

    def delete_vm_completely(self, vmid):
        """Stop and delete a VM, waiting for each step to actually complete.
        Gracefully handles the case where the VM is already gone."""
        
        try:
            status = self.proxmox.nodes(self.node).qemu(vmid).status.current.get()
        except Exception as e:
            error_str = str(e).lower()
            if 'does not exist' in error_str or ('500' in error_str and 'config' in error_str):
                # VM already doesn't exist — this is the desired end state
                import logging
                logger = logging.getLogger(__name__)
                logger.info(
                    f'VM {vmid} already does not exist in Proxmox — '
                    f'treating as already deleted'
                )
                return True
            raise
        
        if status.get('status') == 'running':
            stop_upid = self.proxmox.nodes(self.node).qemu(vmid).status.stop.post()
            self.wait_for_task(stop_upid, timeout=30)
        
        # Now genuinely wait a moment for the lock to release after stop completes
        import time
        time.sleep(3)
        
        try:
            # Delete and WAIT for the delete task to actually finish
            delete_upid = self.proxmox.nodes(self.node).qemu(vmid).delete()
            self.wait_for_task(delete_upid, timeout=60)
        except Exception as e:
            error_str = str(e).lower()
            if 'does not exist' in error_str:
                # Already gone, treat as success
                return True
            raise
        
        return True

    def delete_vm(self, vmid):
        """
        Delete a VM completely (legacy wrapper).
        """
        self.delete_vm_completely(vmid)
        logger.info("Deleted VM %s", vmid)

    def get_vm_ip(self, vmid, max_wait=DEFAULT_MAX_WAIT_SECONDS, progress_callback=None):
        """
        Get the VM's IP address via the QEMU guest agent.

        Polls the guest agent network interfaces until a 192.168.x.x
        address is found, or the timeout is reached.

        Args:
            vmid (int): The Proxmox VM ID.
            max_wait (int): Maximum seconds to wait for an IP.
            progress_callback (callable): Optional callback for progress.

        Returns:
            str or None: The IP address, or None if not found in time.
        """
        waited = 0
        while waited < max_wait:
            if progress_callback:
                progress_callback(waited)
            try:
                result = (
                    self.proxmox
                    .nodes(self.node)
                    .qemu(vmid)
                    .agent
                    .get('network-get-interfaces')
                )

                for iface in result.get('result', []):
                    if iface.get('name') == 'lo':
                        continue
                    for ip_info in iface.get('ip-addresses', []):
                        addr = ip_info.get('ip-address', '')
                        if addr.startswith('192.168'):
                            logger.info("VM %s got IP: %s", vmid, addr)
                            return addr
            except Exception:
                pass  # Guest agent not ready yet

            time.sleep(IP_POLL_INTERVAL_SECONDS)
            waited += IP_POLL_INTERVAL_SECONDS

        logger.warning("VM %s did not get IP within %ss", vmid, max_wait)
        return None

    def enable_vm_lockdown(self, vmid, allowed_domains=None):
        """
        Lock a VM down to no outbound internet access except essential
        gateway/DNS traffic and an optional domain whitelist.

        Rebuilds the VM's firewall rule set from scratch every call, so
        it is safe to call repeatedly (e.g. re-applied after a resume).

        Args:
            vmid (int): The Proxmox VM ID to lock down.
            allowed_domains (list[str] or None): Domains to whitelist in
                addition to the essential gateway/DNS access.
        """
        import socket
        from urllib.parse import urlparse
        from apps.users.models import SystemConfig

        ECOSYSTEM_EXPANSIONS = {
            'github': {
                'domains': [
                    'github.com',
                    'www.github.com',
                    'api.github.com',
                    'github.githubassets.com',
                    'githubassets.com',
                    'raw.githubusercontent.com',
                    'avatars.githubusercontent.com',
                    'avatars0.githubusercontent.com',
                    'avatars1.githubusercontent.com',
                    'avatars2.githubusercontent.com',
                    'avatars3.githubusercontent.com',
                    'objects.githubusercontent.com',
                    'alive.github.com',
                    'collector.github.com',
                    'githubstatus.com',
                    'github.community',
                    'github.io',
                    'github-cloud.s3.amazonaws.com',
                    'copilot.githubassets.com',
                    'github.blog',
                ],
                'cidrs': [
                    '140.82.112.0/20',   # GitHub Main ASN
                    '185.199.108.0/22',  # GitHub Fastly CDN (githubassets, raw, avatars)
                    '192.30.252.0/22',   # GitHub Legacy IP Block
                    '20.201.28.0/22',    # GitHub Azure Anycast Block
                    '20.205.240.0/20',   # GitHub Azure Anycast Block
                    '4.237.22.0/23',     # GitHub Azure Anycast Block
                ]
            },
            'google': {
                'domains': [
                    'google.com',
                    'www.google.com',
                    'accounts.google.com',
                    'apis.google.com',
                    'gstatic.com',
                    'www.gstatic.com',
                    'ssl.gstatic.com',
                    'fonts.gstatic.com',
                    'fonts.googleapis.com',
                    'ajax.googleapis.com',
                    'googleusercontent.com',
                    'drive.google.com',
                    'docs.google.com',
                    'classroom.google.com',
                    'meet.google.com',
                    'mail.google.com',
                ],
                'cidrs': [
                    '142.250.0.0/15',
                    '172.217.0.0/16',
                    '216.58.192.0/19',
                ]
            },
            'python': {
                'domains': [
                    'python.org',
                    'www.python.org',
                    'docs.python.org',
                    'pypi.org',
                    'files.pythonhosted.org',
                    'pypi.python.org',
                    'pythonhosted.org',
                ],
                'cidrs': [
                    '151.101.0.0/16',
                    '199.232.0.0/16',
                ]
            },
            'stackoverflow': {
                'domains': [
                    'stackoverflow.com',
                    'www.stackoverflow.com',
                    'sstatic.net',
                    'cdn.sstatic.net',
                    'stackexchange.com',
                    'www.stackexchange.com',
                    'ajax.googleapis.com',
                ],
                'cidrs': [
                    '151.101.0.0/16',
                    '198.252.206.0/24',
                ]
            },
            'wikipedia': {
                'domains': [
                    'wikipedia.org',
                    'www.wikipedia.org',
                    'en.wikipedia.org',
                    'upload.wikimedia.org',
                    'wikimedia.org',
                    'www.wikimedia.org',
                    'meta.wikimedia.org',
                ],
                'cidrs': [
                    # Real bug found via live testing: this was originally
                    # '208.80.154.0/22' - a genuinely malformed /22 (host
                    # bits set, 154 isn't a valid /22 boundary - Wikimedia's
                    # real published range starts at .152.0). Proxmox
                    # correctly rejected it with a 400 on every real
                    # lockdown call; caught and logged as a warning so it
                    # didn't break the rest of the lockdown, but the CIDR
                    # rule silently never applied. Confirmed the corrected
                    # value with ipaddress.ip_network(..., strict=True).
                    '208.80.152.0/22',
                    '91.198.174.0/24',
                ]
            },
            'dit': {
                'domains': [
                    'dit.ac.tz',
                    'www.dit.ac.tz',
                    'sims.dit.ac.tz',
                    'lms.dit.ac.tz',
                    'mail.dit.ac.tz',
                ],
                'cidrs': []
            },
            'microsoft': {
                'domains': [
                    'microsoft.com',
                    'www.microsoft.com',
                    'login.microsoftonline.com',
                    'live.com',
                    'msftauth.net',
                    'azure.com',
                    'vscode-cdn.azureedge.net',
                    'marketplace.visualstudio.com',
                ],
                'cidrs': []
            },
            'youtube': {
                'domains': [
                    'youtube.com',
                    'www.youtube.com',
                    'googlevideo.com',
                    'ytimg.com',
                    'i.ytimg.com',
                    'gstatic.com',
                    'www.gstatic.com',
                ],
                'cidrs': []
            },
            'w3schools': {
                'domains': [
                    'w3schools.com',
                    'www.w3schools.com',
                    'images.w3schools.com',
                    'cdn.jsdelivr.net',
                ],
                'cidrs': []
            },
            'mdn': {
                'domains': [
                    'developer.mozilla.org',
                    'mozilla.org',
                    'www.mozilla.org',
                    'mozit.cloud',
                ],
                'cidrs': []
            }
        }

        node = self.proxmox.nodes(self.node)

        # Per-VM rules only take effect if the interface opts in.
        try:
            cfg = node.qemu(vmid).config.get()
            net0 = cfg.get('net0', '')
            if net0:
                if 'firewall=0' in net0:
                    node.qemu(vmid).config.post(net0=net0.replace('firewall=0', 'firewall=1'))
                elif 'firewall=1' not in net0:
                    node.qemu(vmid).config.post(net0=net0 + ',firewall=1')
        except Exception as e:
            logger.warning("Could not set firewall=1 on VM %s net0: %s", vmid, e)

        # Rebuild firewall rules from a clean slate
        try:
            existing_rules = node.qemu(vmid).firewall.rules.get()
            for r in sorted(existing_rules, key=lambda x: x.get('pos', 0), reverse=True):
                if 'pos' in r:
                    try:
                        node.qemu(vmid).firewall.rules(r['pos']).delete()
                    except Exception:
                        pass
        except Exception as e:
            logger.warning("Could not clear existing rules on VM %s: %s", vmid, e)

        # 1. Allow essential gateway / DNS IPs — computed BEFORE the DNS
        # port rule below, since that rule now needs to reference these
        # same IPs instead of allowing port 53 to anywhere.
        essential_ips = [
            ip.strip() for ip in
            SystemConfig.get('network_lockdown_allowlist_ips', '192.168.1.1,8.8.8.8,1.1.1.1,8.8.4.4,1.0.0.1').split(',')
            if ip.strip()
        ]

        # 2. Allow outbound DNS traffic (UDP/TCP port 53), but ONLY to the
        # real, intended DNS resolver IPs above — not to any destination.
        #
        # Real vulnerability found and fixed via a security audit: this
        # rule used to ACCEPT port 53 traffic to ANY destination IP
        # (no `dest` restriction at all). Confirmed with a live guest-agent
        # test on a real locked-down VM: a non-whitelisted IP on port 443
        # was correctly BLOCKED, but that exact same IP on port 53 was
        # REACHABLE — a genuine DNS-tunneling bypass (tools like iodine/
        # dnscat2 relay arbitrary traffic over port 53), letting a
        # technically capable user defeat the entire lockdown from inside
        # their own "restricted" VM. Scoping `dest` to the real resolver
        # IPs closes this while still letting genuine DNS lookups through.
        # One rule per IP, not a comma-joined `dest` — real testing showed
        # Proxmox's API only honored the FIRST IP in a comma-joined `dest`
        # value here, which silently blocked DNS to every resolver except
        # the first one (confirmed live: a legitimate whitelisted resolver
        # on port 53 was wrongly blocked until this was split per-IP,
        # matching the already-working per-IP pattern used for essential_ips
        # below).
        for ip in essential_ips:
            try:
                node.qemu(vmid).firewall.rules.post(
                    type='out', proto='udp', dport='53', dest=ip, action='ACCEPT', enable=1,
                    comment='Allow DNS queries (UDP) — resolvers only',
                )
                node.qemu(vmid).firewall.rules.post(
                    type='out', proto='tcp', dport='53', dest=ip, action='ACCEPT', enable=1,
                    comment='Allow DNS queries (TCP) — resolvers only',
                )
            except Exception as e:
                logger.warning("Could not add DNS firewall rule for %s on VM %s: %s", ip, vmid, e)

        for ip in essential_ips:
            try:
                node.qemu(vmid).firewall.rules.post(
                    type='out', action='ACCEPT', dest=ip, enable=1,
                    comment='Essential gateway/DNS connectivity',
                )
            except Exception as e:
                logger.warning("Could not whitelist IP %s for VM %s: %s", ip, vmid, e)

        # 3. Whitelist allowed domains by resolving them to IPs and CIDR subnets
        resolved_ips = set()
        matched_cidrs = set()
        domains_to_resolve = set()
        cleaned_inputs = []

        if allowed_domains:
            if isinstance(allowed_domains, str):
                allowed_domains = [d.strip() for d in allowed_domains.split(',') if d.strip()]

            for raw_item in allowed_domains:
                if not raw_item or not isinstance(raw_item, str):
                    continue
                item = raw_item.strip()
                if '://' in item:
                    try:
                        parsed = urlparse(item)
                        item = parsed.hostname or item
                    except Exception:
                        pass
                item = item.split('/')[0].split(':')[0].strip().lower()
                if not item:
                    continue
                cleaned_inputs.append(item)

                # Check if matches a known ecosystem
                base_name = item.split('.')[0] if '.' in item else item
                matched_eco = ECOSYSTEM_EXPANSIONS.get(base_name) or ECOSYSTEM_EXPANSIONS.get(item)
                if matched_eco:
                    for d in matched_eco.get('domains', []):
                        domains_to_resolve.add(d)
                    for c in matched_eco.get('cidrs', []):
                        matched_cidrs.add(c)
                else:
                    if '.' not in item:
                        item = f'{item}.com'
                    domains_to_resolve.add(item)
                    if item.startswith('www.'):
                        domains_to_resolve.add(item[4:])
                    elif not item.startswith('*') and '.' in item:
                        domains_to_resolve.add(f'www.{item}')

            # Add subnet CIDR rules
            for cidr in matched_cidrs:
                try:
                    node.qemu(vmid).firewall.rules.post(
                        type='out', action='ACCEPT', dest=cidr, enable=1,
                        comment=f'Whitelisted subnet: {cidr}',
                    )
                except Exception as e:
                    logger.warning("Could not add CIDR rule %s for VM %s: %s", cidr, vmid, e)

            # Resolve domain IPs and add rules
            for domain in domains_to_resolve:
                try:
                    addrinfo = socket.getaddrinfo(domain, None, socket.AF_INET)
                    domain_ips = {info[4][0] for info in addrinfo}
                    for ip in domain_ips:
                        if ip in resolved_ips:
                            continue
                        resolved_ips.add(ip)
                        node.qemu(vmid).firewall.rules.post(
                            type='out', action='ACCEPT', dest=ip, enable=1,
                            comment=f'Whitelisted: {domain}',
                        )
                except socket.gaierror as e:
                    logger.warning("Could not resolve whitelisted domain %s: %s", domain, e)
                except Exception as e:
                    logger.warning("Could not add firewall rule for domain %s on VM %s: %s", domain, vmid, e)

        # Enable firewall with drop policy on outbound
        node.qemu(vmid).firewall.options.put(
            enable=1, policy_in='ACCEPT', policy_out='DROP',
        )
        logger.info(
            "Network lockdown enabled on VM %s (essential=%s, cidrs=%s, domains=%s -> %s IPs)",
            vmid, essential_ips, sorted(matched_cidrs), cleaned_inputs, len(resolved_ips),
        )

    def disable_vm_lockdown(self, vmid):
        """
        Fully lift network lockdown on a VM, restoring unrestricted
        outbound access.

        Args:
            vmid (int): The Proxmox VM ID to unlock.
        """
        node = self.proxmox.nodes(self.node)
        try:
            node.qemu(vmid).firewall.options.put(enable=0)
        except Exception as e:
            logger.warning("Could not disable firewall options on VM %s: %s", vmid, e)

        try:
            existing_rules = node.qemu(vmid).firewall.rules.get()
            for r in sorted(existing_rules, key=lambda x: x.get('pos', 0), reverse=True):
                if 'pos' in r:
                    try:
                        node.qemu(vmid).firewall.rules(r['pos']).delete()
                    except Exception:
                        pass
        except Exception as e:
            logger.warning("Could not clear firewall rules on VM %s: %s", vmid, e)

        logger.info("Network lockdown disabled on VM %s", vmid)

    def get_vm_status(self, vmid):
        """
        Get the current status of a VM.

        Args:
            vmid (int): The Proxmox VM ID.

        Returns:
            str: Status string (e.g. 'running', 'stopped', 'unknown').
        """
        try:
            status = (
                self.proxmox
                .nodes(self.node)
                .qemu(vmid)
                .status.current.get()
            )
            return status.get('status', 'unknown')
        except Exception:
            return 'unknown'


def get_proxmox_service():
    import logging
    from decouple import config
    logger = logging.getLogger(__name__)
    logger.error(
        f'[DEBUG] PROXMOX_USER='
        f'{config("PROXMOX_USER", default="MISSING")} '
        f'TOKEN_NAME='
        f'{config("PROXMOX_TOKEN_NAME", default="MISSING")} '
        f'SECRET_LEN='
        f'{len(config("PROXMOX_TOKEN_SECRET", default=""))}'
    )
    return ProxmoxService()
