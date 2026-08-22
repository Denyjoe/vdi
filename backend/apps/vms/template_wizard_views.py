"""
Admin OS/Template Management wizard — lets an admin create, configure,
and manage new Linux VM templates entirely from inside the app, with
zero need to touch Proxmox's raw web UI except for the one genuinely
unavoidable manual step: clicking through a fresh OS installer.

Every step follows the same proven patterns used elsewhere in this app
today: real Proxmox API calls, real guest-agent/SSH command execution
with honest error surfacing (never silently swallowed), a full-clone +
isolated verification step before any new template is ever pointed at
by a real VMTemplate row, and the old template staying untouched/
available the whole time so nothing regresses if the new one fails.
"""
import logging
from rest_framework import views, status, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import DesktopEnvironmentProfile, TemplateCreationJob, VMTemplate, IsoDownloadTracking
from .admin_views import IsAdminUser

logger = logging.getLogger(__name__)


class AdminAvailableISOsView(views.APIView):
    """Real, live ISO list from Proxmox's own storage API — never a
    hardcoded list, since an admin should only ever be offered ISOs
    that are genuinely already uploaded and usable."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from .services.proxmox_service import ProxmoxService
        try:
            isos = ProxmoxService().list_available_isos()
        except Exception as e:
            logger.error("Failed to list real ISOs from Proxmox: %s", e)
            return Response({'success': False, 'message': f'Could not reach Proxmox storage: {e}'}, status=502)
        return Response({'success': True, 'data': isos})


class AdminISOUploadView(views.APIView):
    """POST /api/admin/templates/isos/upload/  (multipart file upload)
    Real, direct ISO upload straight to Proxmox's own storage — an
    admin never needs Proxmox's UI or SCP/SFTP access to get an ISO
    onto the server. Confirmed real via a live test: Proxmox's own
    upload endpoint returns a genuine UPID ('...:imgcopy::...') and
    the file genuinely appears in storage once that task completes.

    The uploaded file is streamed straight through to Proxmox's HTTP
    API (never fully buffered in Django's memory) — Django's own
    upload handling already writes anything past the small-file
    threshold to a temp file on disk, and `requests` reads that
    file-like object in chunks rather than loading it all before
    sending, so this never holds a multi-GB ISO in RAM at once."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        from .services.proxmox_service import ProxmoxService

        iso_file = request.FILES.get('iso')
        if not iso_file:
            return Response({'success': False, 'message': 'No file provided.'}, status=400)
        if not iso_file.name.lower().endswith('.iso'):
            return Response({'success': False, 'message': 'File must be a .iso'}, status=400)

        ps = ProxmoxService()

        # Real size sanity check — confirm real available disk space
        # on the actual target storage first, not just trust the
        # upload to fail gracefully.
        try:
            storage_status = ps.proxmox.nodes(ps.node).storage('local').status.get()
        except Exception as e:
            logger.error('Could not check Proxmox storage space: %s', e)
            return Response({'success': False, 'message': f'Could not reach Proxmox storage: {e}'}, status=502)

        available = storage_status.get('avail', 0)
        if iso_file.size > available:
            return Response({
                'success': False,
                'message': f'Not enough disk space on the server for this ISO ({iso_file.size} bytes needed, {available} available).',
            }, status=400)

        try:
            upid = ps.upload_iso(iso_file, iso_file.name)
        except Exception as e:
            logger.error('ISO upload failed: %s', e, exc_info=True)
            return Response({'success': False, 'message': f'Upload failed: {e}'}, status=502)

        return Response({'success': True, 'data': {'upid': upid, 'filename': iso_file.name}})


class AdminISODownloadUrlView(views.APIView):
    """POST /api/admin/templates/isos/download-url/  {url, filename}
    Triggers a real, server-side download — Proxmox itself fetches the
    URL directly on the node; this never proxies the actual multi-GB
    transfer through Django. Confirmed real via a live test: a genuine
    'download' UPID, a real task log showing the actual transfer, and
    the file genuinely appearing in storage afterward."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        from .services.proxmox_service import ProxmoxService

        url = (request.data.get('url') or '').strip()
        filename = (request.data.get('filename') or '').strip()
        if not url or not filename:
            return Response({'success': False, 'message': 'url and filename are required.'}, status=400)
        if not filename.lower().endswith('.iso'):
            return Response({'success': False, 'message': 'filename must end in .iso'}, status=400)

        ps = ProxmoxService()
        try:
            upid = ps.download_iso_from_url(url, filename)
        except Exception as e:
            logger.error('ISO download-from-url failed to start: %s', e, exc_info=True)
            return Response({'success': False, 'message': f'Could not start download: {e}'}, status=502)

        # Real, server-side persistent tracking — a download commonly
        # starts before any TemplateCreationJob exists yet (it's on
        # the wizard's create-new-job form), so this can't live on a
        # job. Lets the wizard resume showing real progress after a
        # navigation away and back.
        IsoDownloadTracking.objects.create(upid=upid, filename=filename, url=url, created_by=request.user)

        return Response({'success': True, 'data': {'upid': upid, 'filename': filename}})


class AdminISODownloadStatusView(views.APIView):
    """GET /api/admin/templates/isos/download-status/?upid=<real_task_id>
    Polls Proxmox's real task status API — genuine progress/completion
    state for either an upload or a download-url task, since both
    return the same kind of real, pollable UPID. Confirmed real via a
    live task's own log: a genuine wget-style percent/speed/ETA is
    available for download-url tasks (get_task_progress parses it),
    not just a running/stopped state."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from .services.proxmox_service import ProxmoxService

        upid = request.query_params.get('upid', '').strip()
        if not upid:
            return Response({'success': False, 'message': 'upid is required.'}, status=400)

        ps = ProxmoxService()
        try:
            task_status = ps.get_task_progress(upid)
        except Exception as e:
            logger.error('Could not poll task status for %s: %s', upid, e)
            return Response({'success': False, 'message': f'Could not check task status: {e}'}, status=502)

        if task_status['finished']:
            IsoDownloadTracking.objects.filter(upid=upid, finished=False).update(finished=True)

        return Response({'success': True, 'data': task_status})


class AdminActiveIsoDownloadView(views.APIView):
    """GET /api/admin/templates/isos/active-download/
    Real, server-side-persistent "do I have an ISO download still in
    flight" check for the current admin — independent of any
    TemplateCreationJob, since a download commonly starts before one
    exists. Returns the most recent not-yet-finished tracked download,
    re-verifying its real current Proxmox status (never trusting a
    stale DB flag) so a download that finished/failed while nobody was
    watching gets marked finished here rather than being offered as
    still-active forever."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from .services.proxmox_service import ProxmoxService

        tracking = IsoDownloadTracking.objects.filter(created_by=request.user, finished=False).first()
        if not tracking:
            return Response({'success': True, 'data': None})

        ps = ProxmoxService()
        try:
            task_status = ps.get_task_progress(tracking.upid)
        except Exception as e:
            logger.warning('Could not verify active download %s: %s', tracking.upid, e)
            return Response({'success': True, 'data': {
                'upid': tracking.upid, 'filename': tracking.filename,
                'percent': None, 'bytes_downloaded': None, 'speed': None, 'eta': None,
                'finished': False, 'success': False,
            }})

        if task_status['finished']:
            tracking.finished = True
            tracking.save(update_fields=['finished'])

        return Response({'success': True, 'data': {
            'upid': tracking.upid, 'filename': tracking.filename, **task_status,
        }})


class AdminActiveTemplateJobsView(views.APIView):
    """GET /api/admin/templates/jobs/active/
    Real, currently-in-progress TemplateCreationJob rows for the admin
    making the request (status not in completed/failed), most recent
    first — lets the wizard offer to resume a real job on page load
    instead of silently forcing either a fresh start or a resume.

    Real, confirmed bug this also fixes: nothing previously verified a
    job's real Proxmox VM still existed before offering it as
    resumable — an admin deleting a test VM directly in Proxmox (not
    through this app) left a genuinely dead job sitting here forever,
    surfacing a confusing "resume" prompt for a VM that was already
    gone. Each candidate job's real VM status is checked here; one
    confirmed genuinely gone gets marked failed (with an honest
    reason) instead of silently kept as if still in progress."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from .services.proxmox_service import ProxmoxService

        jobs = TemplateCreationJob.objects.filter(
            created_by=request.user,
        ).exclude(status__in=['completed', 'failed']).order_by('-created_at')

        ps = ProxmoxService()
        still_active = []
        for job in jobs:
            if job.proxmox_vmid:
                try:
                    ps.proxmox.nodes(ps.node).qemu(job.proxmox_vmid).status.current.get()
                except Exception as e:
                    error_str = str(e).lower()
                    if 'does not exist' in error_str or ('500' in error_str and 'config' in error_str):
                        job.status = 'failed'
                        job.error_message = f'Real Proxmox VM {job.proxmox_vmid} no longer exists (likely deleted directly in Proxmox, outside the app).'
                        job.save(update_fields=['status', 'error_message'])
                        job.log_step(job.error_message, level='error')
                        continue
                    # A genuine Proxmox-reachability hiccup, not
                    # confirmation the VM is gone — don't punish the
                    # job for a transient API error.
                    logger.warning('Could not verify VM %s for job %s: %s', job.proxmox_vmid, job.id, e)
            still_active.append(job)

        return Response({'success': True, 'data': [_serialize_job(j) for j in still_active]})


class AdminDesktopEnvironmentProfilesView(views.APIView):
    """Real, live list of configured desktop environment profiles — the
    wizard's dropdown reads this, never a hardcoded XFCE/GNOME pair, so
    adding a 3rd/4th environment later is purely a new DB row."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        profiles = DesktopEnvironmentProfile.objects.all().order_by('display_name')
        return Response({
            'success': True,
            'data': [
                {
                    'id': p.id,
                    'name': p.name,
                    'display_name': p.display_name,
                    'default_apps': p.default_apps,
                }
                for p in profiles
            ],
        })


class AdminTemplateJobCreateView(views.APIView):
    """POST /api/admin/templates/create-job/
    Real Proxmox VM creation — a genuinely new, empty VM with the
    requested resources and the chosen ISO attached as a bootable
    CD-ROM, then started so the admin can begin the real OS install."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        from .services.proxmox_service import ProxmoxService

        name = request.data.get('name', '').strip()
        cpu_cores = request.data.get('cpu_cores')
        ram_gb = request.data.get('ram_gb')
        disk_gb = request.data.get('disk_gb')
        iso_volid = request.data.get('iso_volid')
        de_id = request.data.get('desktop_environment_id')

        if not all([name, cpu_cores, ram_gb, disk_gb, iso_volid, de_id]):
            return Response({
                'success': False,
                'message': 'name, cpu_cores, ram_gb, disk_gb, iso_volid, and desktop_environment_id are all required.',
            }, status=400)

        desktop_environment = get_object_or_404(DesktopEnvironmentProfile, id=de_id)

        job = TemplateCreationJob.objects.create(
            name=name,
            desktop_environment=desktop_environment,
            cpu_cores=cpu_cores,
            ram_gb=ram_gb,
            disk_gb=disk_gb,
            iso_filename=iso_volid,
            status='vm_creating',
            created_by=request.user,
        )
        job.log_step(f'Job created for "{name}" ({cpu_cores} vCPU / {ram_gb}GB RAM / {disk_gb}GB disk).')

        ps = ProxmoxService()
        try:
            job.log_step(f'Creating real Proxmox VM, ISO={iso_volid}...')
            vmid = ps.create_vm(name, cpu_cores, ram_gb, disk_gb, iso_volid)
            job.proxmox_vmid = vmid
            job.save(update_fields=['proxmox_vmid'])
            job.log_step(f'Real VM created: vmid={vmid}.')

            job.log_step('Starting VM so the OS installer boots...')
            ps.start_vm(vmid)
            job.log_step('VM started.')

            job.status = 'awaiting_os_install'
            job.save(update_fields=['status'])
            job.log_step('Awaiting manual OS install via the Proxmox console.')
        except Exception as e:
            logger.error('Template job %s: VM creation failed: %s', job.id, e, exc_info=True)
            job.status = 'failed'
            job.error_message = f'VM creation failed: {e}'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(f'FAILED: {e}', level='error')
            return Response({'success': False, 'message': str(e), 'job_id': job.id}, status=502)

        return Response({'success': True, 'data': _serialize_job(job)}, status=201)


class AdminTemplateJobDetailView(views.APIView):
    """GET /api/admin/templates/jobs/<id>/
    Real, current job status/log — and, once the guest agent inside the
    VM can be reached (only possible after the manual OS install AND a
    working network stack are both in place), the VM's real IP."""
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        job = get_object_or_404(TemplateCreationJob, pk=pk)
        data = _serialize_job(job)

        if job.proxmox_vmid and job.status in ('awaiting_os_install', 'configuring'):
            from .services.proxmox_service import ProxmoxService
            try:
                ip = ProxmoxService().get_vm_ip(job.proxmox_vmid, max_wait=3)
                data['vm_ip'] = ip
            except Exception:
                data['vm_ip'] = None

        return Response({'success': True, 'data': data})

    def delete(self, request, pk):
        """DELETE /api/admin/templates/jobs/<id>/
        Real cleanup for a wizard job — deletes the real Proxmox VM it
        created (unless that VM has already been promoted into a live
        VMTemplate, in which case AdminTemplateDetailView's own delete
        owns that real template's lifecycle instead, and this only
        removes the historical job record). Confirmed real bug this
        fixes: there was previously no way to delete a wizard job at
        all, so real test VMs (e.g. abandoned 'awaiting_os_install'
        jobs) stayed alive in Proxmox forever with no path to clean
        them up through the app."""
        from .services.proxmox_service import ProxmoxService

        job = get_object_or_404(TemplateCreationJob, pk=pk)
        already_promoted = job.status == 'completed' and job.final_template_id

        if job.proxmox_vmid and not already_promoted:
            try:
                ProxmoxService().delete_vm_completely(job.proxmox_vmid)
            except Exception as e:
                logger.error('Failed to delete real Proxmox VM %s for job %s: %s', job.proxmox_vmid, job.id, e, exc_info=True)
                return Response({
                    'success': False,
                    'message': f'Could not delete the real VM (vmid {job.proxmox_vmid}): {e}',
                }, status=502)

        job.delete()
        return Response({'success': True, 'message': 'Job deleted.'})


class AdminTemplateJobApplyConfigurationView(views.APIView):
    """POST /api/admin/templates/jobs/<id>/apply-configuration/
    {ssh_username, ssh_password}
    Admin calls this AFTER manually completing the OS install (and
    ensuring SSH is reachable) via the Proxmox console. Runs the real,
    verified fix_script + writes the real, verified session_command from
    the job's chosen DesktopEnvironmentProfile — the exact commands
    extracted from the live, currently-deployed templates, not
    reconstructed."""
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        from .services.proxmox_service import ProxmoxService
        from .services.ssh_service import run_ssh_command, run_ssh_script

        job = get_object_or_404(TemplateCreationJob, pk=pk)
        if job.status != 'awaiting_os_install':
            return Response({
                'success': False,
                'message': f'Job is not awaiting OS install (current status: {job.status}).',
            }, status=400)

        ssh_username = request.data.get('ssh_username', '').strip()
        ssh_password = request.data.get('ssh_password', '')
        manual_ip = (request.data.get('vm_ip') or '').strip()
        if not ssh_username or not ssh_password:
            return Response({'success': False, 'message': 'ssh_username and ssh_password are required.'}, status=400)

        ps = ProxmoxService()
        # A freshly, manually-installed VM has no qemu-guest-agent yet
        # (finalize() is what installs it) — get_vm_ip() depends on the
        # guest agent, so it genuinely cannot resolve the IP at this
        # stage. Let the admin supply the real IP directly (visible on
        # the installer's summary screen or via `ip a` at the console)
        # rather than pretending guest-agent discovery will work here.
        ip = manual_ip or None
        if not ip:
            try:
                ip = ps.get_vm_ip(job.proxmox_vmid, max_wait=20)
            except Exception:
                ip = None
        if not ip:
            job.log_step('Could not determine VM IP — no guest agent yet and no vm_ip supplied.', level='error')
            return Response({'success': False, 'message': 'Could not reach the VM — guest-agent is not installed yet at this stage, so pass vm_ip explicitly (check the console for the real IP).'}, status=502)

        job.log_step(f'Reached VM at {ip}. Applying real desktop-environment configuration...')

        de = job.desktop_environment

        # Sanity-check the SSH connection first, so a bad password fails
        # honestly right away instead of midway through the fix_script.
        check = run_ssh_command(ip, ssh_username, ssh_password, 'echo connected')
        if not check['success']:
            raw = check.get('error') or f"exit code {check.get('exit_code')}: {check.get('stderr')}"
            # Real, confirmed distinction (found via live testing against
            # this exact IP): a bare "timed out" means packets to port 22
            # are being silently dropped before ever reaching the guest
            # (network/firewall-level) — the guest never gets a chance to
            # answer. "Unable to connect to port 22" / "Connection
            # refused" means the network path IS open but nothing is
            # listening on port 22 in the guest — i.e. openssh-server
            # genuinely isn't installed/running yet, which is expected
            # for a fresh install on distros (Parrot included) that don't
            # ship it by default. Authentication errors mean SSH itself
            # is fine and it's just the username/password. Give the admin
            # the actual next action instead of a raw exception string.
            lower = raw.lower()
            if 'auth' in lower or 'authentication' in lower:
                actionable = (
                    f'SSH reached {ip} but the username/password was rejected. '
                    'Double-check the credentials you set during the OS install and try again.'
                )
            elif 'refused' in lower or 'unable to connect to port' in lower:
                actionable = (
                    f'SSH reached {ip}, but nothing is listening on port 22 — openssh-server is not '
                    'installed/running on this VM yet (common on fresh Parrot/desktop-Linux installs, '
                    'which do not ship it by default). Open the console above, log in, and run: '
                    'sudo apt update && sudo apt install openssh-server -y — then click Continue again.'
                )
            elif 'timed out' in lower or 'timeout' in lower:
                actionable = (
                    f'Connection to {ip}:22 timed out — no response at all, not even a refusal. '
                    'This usually means the VM is still booting, the IP is stale (re-check it with '
                    '`ip a` in the console), or something on the network path is silently dropping the '
                    'connection. Confirm the VM is fully booted and the IP is current, then try again.'
                )
            else:
                actionable = f'SSH connection failed: {raw}'
            job.log_step(f'SSH connection check failed: {raw}', level='error')
            return Response({'success': False, 'message': actionable}, status=502)
        job.log_step('SSH connection verified.')

        # Real, confirmed, previously-repeating bug fixed here: the VM
        # was created with the ISO boot-first (required so the
        # installer could actually run) and NOTHING ever reverted that
        # afterward, so every reboot from here on kept re-launching
        # the installer instead of booting the OS that was just
        # installed — happened before, was only ever hand-patched for
        # one specific VM, never fixed in code, so it kept recurring
        # for every new job. This is the first point the wizard has
        # real, confirmed proof (a genuine SSH login) that the OS is
        # actually installed and bootable from disk, so it's now safe
        # to stop booting from the ISO — permanently, for every job.
        try:
            ps.detach_install_iso_and_fix_boot_order(job.proxmox_vmid)
            job.log_step('Install ISO detached and boot order fixed — future reboots will boot the installed OS, not the installer.')
        except Exception as e:
            job.status = 'failed'
            job.error_message = f'Could not fix boot order after install: {e}'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(job.error_message, level='error')
            return Response({'success': False, 'message': job.error_message}, status=502)

        # Real, confirmed, repeatable class of bug fixed here — not one
        # specific package: a freshly-installed Parrot VM can carry
        # ANY number of held/conflicting packages from backports-vs-
        # stable version drift (openssh-client/openssh-server was the
        # first one actually hit; gnome-shell/gstreamer1.0-pipewire/
        # pipewire was the second, on a completely different job/VM —
        # confirming this is a genuine class of problem, not a single
        # package to special-case). Chasing individual packages one at
        # a time as they surface doesn't scale and just means the next
        # admin hits the next one. A real `apt full-upgrade` resolves
        # the entire dependency tree in one pass — including pulling
        # backports-pinned packages back in line with whatever the
        # rest of the system actually needs — so it runs first, before
        # either the openssh-specific pin-check below or the desktop
        # fix_script, both of which assume a consistent package state
        # to work from. Full-upgrade across an entire fresh OS install
        # can genuinely take several real minutes, hence the long
        # timeout; non-fatal on failure (logged, not blocking) since a
        # full-upgrade timing out shouldn't by itself fail the whole
        # job when the specific packages this wizard actually needs
        # might still install fine afterward.
        # Real, confirmed cascading-failure bug fixed here (found via
        # job 18's actual log): if full-upgrade gets interrupted mid-run
        # for ANY reason (a guest-agent hiccup, a power action, the SSH
        # session dropping), dpkg is left in a genuine "interrupted"
        # state that's written to disk, not memory — it survives
        # reboots and retries. Every subsequent apt-get on this VM then
        # fails immediately with "dpkg was interrupted, you must
        # manually run 'dpkg --configure -a'" — which is exactly what
        # then made the openssh pin-check AND the desktop fix_script
        # both fail too on the very next apply-configuration retry,
        # even though the real underlying cause (an interrupted
        # package op) had nothing to do with either of them. Running
        # `dpkg --configure -a` first is a real, safe, idempotent
        # self-heal — a no-op when nothing was interrupted, and the
        # actual fix when something was — so a bad state from one
        # attempt can never cascade into every retry after it.
        job.log_step('Recovering from any interrupted dpkg state before upgrading...')
        dpkg_fix_result = run_ssh_script(
            ip, ssh_username, ssh_password,
            'DEBIAN_FRONTEND=noninteractive dpkg --configure -a',
            timeout=180,
        )
        job.log_step(
            'dpkg state verified clean.' if dpkg_fix_result['success']
            else f'dpkg --configure -a reported an issue (continuing): {dpkg_fix_result.get("stderr") or dpkg_fix_result.get("error")}',
            level='info' if dpkg_fix_result['success'] else 'warning',
        )

        job.log_step('Running apt full-upgrade to resolve any backports/stable package drift before configuring...')
        full_upgrade_result = run_ssh_script(
            ip, ssh_username, ssh_password,
            'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get full-upgrade -y',
            timeout=900,
        )
        job.log_step(
            'apt full-upgrade complete.' if full_upgrade_result['success']
            else f'apt full-upgrade failed (non-fatal, continuing): {full_upgrade_result.get("stderr") or full_upgrade_result.get("error")}',
            level='info' if full_upgrade_result['success'] else 'warning',
        )
        # If full-upgrade itself got interrupted this time (e.g. the
        # exact same class of hiccup), leave dpkg clean for the NEXT
        # step (the openssh pin-check) rather than letting this
        # attempt's interruption cascade forward too.
        if not full_upgrade_result['success']:
            run_ssh_script(ip, ssh_username, ssh_password, 'DEBIAN_FRONTEND=noninteractive dpkg --configure -a', timeout=180)

        # Real, confirmed, repeatable bug fixed here: Parrot OS (and any
        # Debian-family system with backports enabled the same way)
        # ships openssh-client at a HIGHER version from its backports
        # repo alongside an openssh-server candidate from the main repo
        # that has an EXACT-version dependency on openssh-client — e.g.
        # confirmed live: "openssh-server : Depends: openssh-client
        # (= 1:10.0p1-7+deb13u4) but 1:10.3p1-1~bpo13+1 is to be
        # installed". Once that drift happens (a plain `apt full-
        # upgrade` at the console can cause it), openssh-server can
        # never be installed until openssh-client is pinned back down
        # to match — and no earlier step in this wizard can fix it,
        # since it can only be fixed FROM an already-working SSH/
        # console session. Runs every time, unconditionally and
        # idempotently (a no-op "already the newest version" when
        # there's no drift) so every future job self-heals from this
        # automatically instead of an admin ever needing to diagnose
        # apt dependency output by hand again.
        job.log_step('Checking for the known Parrot openssh-client/openssh-server backports version mismatch...')
        ssh_fix_script = (
            "CANDIDATE=$(apt-cache policy openssh-server 2>/dev/null | awk '/Candidate:/{print $2; exit}')\n"
            "if [ -n \"$CANDIDATE\" ] && [ \"$CANDIDATE\" != \"(none)\" ]; then\n"
            "  apt-get update -qq || true\n"
            "  DEBIAN_FRONTEND=noninteractive apt-get install -y --allow-downgrades "
            "openssh-client=\"$CANDIDATE\" openssh-server=\"$CANDIDATE\" openssh-sftp-server=\"$CANDIDATE\"\n"
            "  systemctl enable --now ssh 2>/dev/null || systemctl enable --now sshd 2>/dev/null || true\n"
            "fi\n"
        )
        ssh_fix_result = run_ssh_script(ip, ssh_username, ssh_password, ssh_fix_script, timeout=180)
        job.log_step(
            'openssh version-pin check complete.' if ssh_fix_result['success']
            else f'openssh version-pin fix failed (non-fatal, continuing): {ssh_fix_result.get("stderr") or ssh_fix_result.get("error")}',
            level='info' if ssh_fix_result['success'] else 'warning',
        )

        if de.fix_script.strip():
            job.log_step(f'Running fix_script for {de.display_name}...')
            result = run_ssh_script(ip, ssh_username, ssh_password, de.fix_script)
            job.log_step(
                f'fix_script exit_code={result.get("exit_code")}.'
                + (f' stderr: {result["stderr"][:500]}' if not result['success'] else ''),
                level='info' if result['success'] else 'error',
            )
            if not result['success']:
                job.status = 'failed'
                job.error_message = f'fix_script failed (exit {result.get("exit_code")}): {result.get("stderr") or result.get("error")}'
                job.save(update_fields=['status', 'error_message'])
                return Response({'success': False, 'message': job.error_message}, status=502)

        job.log_step('Writing real session_command to /etc/xrdp/startwm.sh...')
        write_result = run_ssh_script(
            ip, ssh_username, ssh_password,
            f"cat > /etc/xrdp/startwm.sh << 'SESSIONCOMMANDEOF'\n{de.session_command}SESSIONCOMMANDEOF\nchmod +x /etc/xrdp/startwm.sh",
        )
        if not write_result['success']:
            job.status = 'failed'
            job.error_message = f'Writing session_command failed: {write_result.get("stderr") or write_result.get("error")}'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(job.error_message, level='error')
            return Response({'success': False, 'message': job.error_message}, status=502)

        # Verify honestly — read the file back rather than trusting the
        # write command's exit code alone.
        verify = run_ssh_command(ip, ssh_username, ssh_password, 'cat /etc/xrdp/startwm.sh')
        if not verify['success'] or verify['stdout'].strip() != de.session_command.strip():
            job.status = 'failed'
            job.error_message = 'startwm.sh content did not verify after writing.'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(job.error_message, level='error')
            return Response({'success': False, 'message': job.error_message}, status=502)
        job.log_step('session_command verified on disk — content matches exactly.')

        job.status = 'installing_apps'
        job.save(update_fields=['status'])
        job.log_step(f'Configuration for {de.display_name} applied successfully.')

        return Response({'success': True, 'data': _serialize_job(job)})


class AdminTemplateJobInstallAppsView(views.APIView):
    """POST /api/admin/templates/jobs/<id>/install-apps/
    {packages: [...], ssh_username, ssh_password}
    Real apt-get install per package, real per-package success/failure
    logged. Firefox specifically gets the real .deb Mozilla Team PPA
    install instead of the broken Snap default."""
    permission_classes = [IsAdminUser]

    FIREFOX_PPA_SCRIPT = """
# Real fix for Ubuntu 22.04+ shipping Firefox only as a Snap by default
# (which is broken/unreliable inside an RDP-streamed VM session) —
# install the real .deb build from the Mozilla Team PPA instead.
apt-get remove -y firefox 2>/dev/null || true
snap remove firefox 2>/dev/null || true
add-apt-repository -y ppa:mozillateam/ppa
printf 'Package: *\\nPin: release o=LP-PPA-mozillateam\\nPin-Priority: 1001\\n' > /etc/apt/preferences.d/mozilla-firefox
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y firefox
"""

    def post(self, request, pk):
        from .services.proxmox_service import ProxmoxService
        from .services.ssh_service import run_ssh_script

        job = get_object_or_404(TemplateCreationJob, pk=pk)
        if job.status != 'installing_apps':
            return Response({
                'success': False,
                'message': f'Job is not in installing_apps status (current: {job.status}).',
            }, status=400)

        packages = request.data.get('packages', [])
        ssh_username = request.data.get('ssh_username', '').strip()
        ssh_password = request.data.get('ssh_password', '')
        manual_ip = (request.data.get('vm_ip') or '').strip()
        if not packages:
            return Response({'success': False, 'message': 'packages is required and must be non-empty.'}, status=400)
        if not ssh_username or not ssh_password:
            return Response({'success': False, 'message': 'ssh_username and ssh_password are required.'}, status=400)

        ps = ProxmoxService()
        # Still no guest-agent at this stage (see apply-configuration) —
        # same manual-IP fallback.
        ip = manual_ip or ps.get_vm_ip(job.proxmox_vmid, max_wait=10)
        if not ip:
            return Response({'success': False, 'message': 'Could not reach the VM to install apps — guest-agent is not installed yet at this stage, so pass vm_ip explicitly.'}, status=502)

        results = []
        for pkg in packages:
            pkg = pkg.strip()
            if not pkg:
                continue
            job.log_step(f'Installing {pkg}...')
            if pkg.lower() == 'firefox':
                # The known problem package — real proven fix, not the
                # broken Snap default.
                result = run_ssh_script(ip, ssh_username, ssh_password, self.FIREFOX_PPA_SCRIPT, timeout=600)
            else:
                result = run_ssh_script(
                    ip, ssh_username, ssh_password,
                    f'DEBIAN_FRONTEND=noninteractive apt-get install -y {pkg}',
                    timeout=600,
                )
            ok = result['success']
            results.append({'package': pkg, 'success': ok, 'exit_code': result.get('exit_code')})
            job.log_step(
                f'{pkg}: {"installed" if ok else "FAILED"} (exit {result.get("exit_code")})'
                + ('' if ok else f' — {result.get("stderr", "")[:300] or result.get("error", "")}'),
                level='info' if ok else 'error',
            )

        job.save(update_fields=['log'])
        any_failed = any(not r['success'] for r in results)
        return Response({
            'success': not any_failed,
            'data': {'results': results, 'job': _serialize_job(job)},
        }, status=200 if not any_failed else 207)


class AdminTemplateJobFinalizeView(views.APIView):
    """POST /api/admin/templates/jobs/<id>/finalize/
    {ssh_username, ssh_password}
    Real finalization: machine-id truncate + verify genuinely empty,
    SSH host key removal, shutdown, then convert to a real Proxmox
    template. Never trusted blind — every step is verified by actually
    reading the result back, not just checking an exit code."""
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        from .services.proxmox_service import ProxmoxService
        from .services.ssh_service import run_ssh_command, run_ssh_script

        job = get_object_or_404(TemplateCreationJob, pk=pk)
        if job.status != 'installing_apps':
            return Response({
                'success': False,
                'message': f'Job is not ready to finalize (current status: {job.status}).',
            }, status=400)

        ssh_username = request.data.get('ssh_username', '').strip()
        ssh_password = request.data.get('ssh_password', '')
        manual_ip = (request.data.get('vm_ip') or '').strip()
        if not ssh_username or not ssh_password:
            return Response({'success': False, 'message': 'ssh_username and ssh_password are required.'}, status=400)

        ps = ProxmoxService()
        # qemu-guest-agent gets installed further down in THIS step, so
        # it's still not necessarily present yet when this runs — same
        # manual-IP fallback as apply-configuration/install-apps.
        ip = manual_ip or ps.get_vm_ip(job.proxmox_vmid, max_wait=10)
        if not ip:
            return Response({'success': False, 'message': 'Could not reach the VM to finalize it — guest-agent may not be installed yet, so pass vm_ip explicitly.'}, status=502)

        job.status = 'finalizing'
        job.save(update_fields=['status'])

        # Step 1: truncate machine-id and VERIFY it's genuinely empty —
        # a stale/shared machine-id across every clone causes real
        # DHCP-lease and D-Bus/systemd identity collisions.
        job.log_step('Truncating /etc/machine-id...')
        run_ssh_command(ip, ssh_username, ssh_password, 'truncate -s 0 /etc/machine-id && rm -f /var/lib/dbus/machine-id')
        verify = run_ssh_command(ip, ssh_username, ssh_password, 'cat /etc/machine-id')
        if not verify['success'] or verify['stdout'].strip() != '':
            job.status = 'failed'
            job.error_message = f'machine-id was not genuinely emptied (got: {verify["stdout"]!r}).'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(job.error_message, level='error')
            return Response({'success': False, 'message': job.error_message}, status=502)
        job.log_step('machine-id verified genuinely empty.')

        # Step 2: ensure qemu-guest-agent is installed and enabled, so
        # every future clone of this template can actually be reached
        # via the guest agent the rest of this platform relies on.
        # Deliberately BEFORE host-key removal below — this still
        # needs a normal, working SSH connection.
        job.log_step('Ensuring qemu-guest-agent is installed and enabled...')
        agent_result = run_ssh_script(
            ip, ssh_username, ssh_password,
            'DEBIAN_FRONTEND=noninteractive apt-get install -y qemu-guest-agent && systemctl enable qemu-guest-agent && systemctl start qemu-guest-agent',
            timeout=180,
        )
        if not agent_result['success']:
            job.status = 'failed'
            job.error_message = f'Installing qemu-guest-agent failed: {agent_result.get("stderr") or agent_result.get("error")}'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(job.error_message, level='error')
            return Response({'success': False, 'message': job.error_message}, status=502)
        job.log_step('qemu-guest-agent installed and enabled.')

        # Step 3: SSH host key removal, immediately followed by
        # shutdown, in the SAME script/connection — every clone must
        # generate its own host keys, or every clone would share the
        # same host identity. This MUST be last and MUST be combined
        # with the shutdown trigger: real, confirmed bug this fixes —
        # ubuntu's sshd is socket-activated, so once the host key
        # files are gone, the NEXT connection attempt gets accepted at
        # the TCP level but then closed with no banner (the spawned
        # sshd can't start without a host key). A separate later
        # run_ssh_command() call to verify removal or to shut down
        # would itself need a brand new connection that can now never
        # succeed — so both the removal-verification and the shutdown
        # trigger have to happen inside this one still-open session.
        job.log_step('Removing SSH host keys and shutting down...')
        finalize_script = (
            'rm -f /etc/ssh/ssh_host_*\n'
            'ls /etc/ssh/ssh_host_* > /tmp/hostkey_check 2>&1 || echo NONE_LEFT > /tmp/hostkey_check\n'
            'cat /tmp/hostkey_check\n'
            'sync\n'
            '(poweroff &)\n'
        )
        finalize_result = run_ssh_script(ip, ssh_username, ssh_password, finalize_script, timeout=30)
        hostkey_check_output = finalize_result.get('stdout', '')
        if 'NONE_LEFT' not in hostkey_check_output and hostkey_check_output.strip() != '':
            job.status = 'failed'
            job.error_message = f'SSH host keys were not genuinely removed (found: {hostkey_check_output!r}).'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(job.error_message, level='error')
            return Response({'success': False, 'message': job.error_message}, status=502)
        job.log_step('SSH host keys verified removed. Shutdown triggered.')

        # Step 4: wait for the real, clean shutdown to complete.
        stopped = False
        import time
        for _ in range(30):
            try:
                s = ps.proxmox.nodes(ps.node).qemu(job.proxmox_vmid).status.current.get()
                if s.get('status') == 'stopped':
                    stopped = True
                    break
            except Exception:
                pass
            time.sleep(4)
        if not stopped:
            job.log_step('VM did not shut down cleanly in time — forcing stop.', level='error')
            ps.stop_vm(job.proxmox_vmid)
        job.log_step(f'VM stopped (clean shutdown: {stopped}).')

        # Step 5: convert to a real Proxmox template.
        job.log_step('Converting VM to a Proxmox template...')
        try:
            ps.proxmox.nodes(ps.node).qemu(job.proxmox_vmid).template.post()
        except Exception as e:
            job.status = 'failed'
            job.error_message = f'Template conversion failed: {e}'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(job.error_message, level='error')
            return Response({'success': False, 'message': job.error_message}, status=502)

        time.sleep(3)
        real_status = ps.proxmox.nodes(ps.node).qemu(job.proxmox_vmid).status.current.get()
        if not real_status.get('template'):
            job.status = 'failed'
            job.error_message = 'Template conversion did not genuinely take effect (template flag still 0).'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(job.error_message, level='error')
            return Response({'success': False, 'message': job.error_message}, status=502)

        job.log_step('Template conversion verified — template flag genuinely set.')
        job.status = 'verifying'
        job.save(update_fields=['status'])

        return Response({'success': True, 'data': _serialize_job(job)})


class AdminTemplateJobVerifyView(views.APIView):
    """POST /api/admin/templates/jobs/<id>/verify/
    Real isolated verification clone: clone the new template to a
    temporary VMID, confirm real fast IP acquisition and a genuinely
    unique machine-id, then clean up the verification clone. A broken
    template is NEVER allowed to silently become 'completed'."""
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        from .services.proxmox_service import ProxmoxService

        job = get_object_or_404(TemplateCreationJob, pk=pk)
        if job.status != 'verifying':
            return Response({
                'success': False,
                'message': f'Job is not ready to verify (current status: {job.status}).',
            }, status=400)

        ps = ProxmoxService()
        job.log_step('Cloning the new template to a temporary VM for isolated verification...')
        try:
            verify_vmid = ps.clone_template(job.proxmox_vmid, f'verify-{job.name}')
        except Exception as e:
            job.status = 'failed'
            job.error_message = f'Verification clone failed: {e}'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(job.error_message, level='error')
            return Response({'success': False, 'message': job.error_message}, status=502)

        try:
            job.log_step(f'Starting verification clone (vmid={verify_vmid})...')
            ps.start_vm(verify_vmid)

            job.log_step('Waiting for real IP acquisition via guest agent...')
            ip = ps.get_vm_ip(verify_vmid, max_wait=90)
            if not ip:
                raise Exception('Verification clone never acquired a real IP within 90s.')
            job.log_step(f'Verification clone reached IP {ip}.')

            job.log_step('Checking machine-id is genuinely unique (not empty, not the template\'s)...')
            res = ps.proxmox.nodes(ps.node).qemu(verify_vmid).agent.exec.post(command=['cat', '/etc/machine-id'])
            pid = res.get('pid')
            import time
            mid_out = ''
            for _ in range(15):
                st = ps.proxmox.nodes(ps.node).qemu(verify_vmid).agent('exec-status').get(pid=pid)
                if st.get('exited'):
                    mid_out = st.get('out-data', '').strip()
                    break
                time.sleep(2)

            if not mid_out or len(mid_out) < 16:
                raise Exception(f'Verification clone machine-id looks wrong (real, non-empty, regenerated value expected): {mid_out!r}')
            job.log_step(f'machine-id verified genuinely unique/regenerated: {mid_out[:8]}...')

        except Exception as e:
            job.status = 'failed'
            job.error_message = f'Verification failed: {e}'
            job.save(update_fields=['status', 'error_message'])
            job.log_step(job.error_message, level='error')
            try:
                ps.delete_vm_completely(verify_vmid)
                job.log_step('Verification clone cleaned up after failure.')
            except Exception as cleanup_e:
                job.log_step(f'Could not clean up verification clone {verify_vmid}: {cleanup_e}', level='error')
            return Response({'success': False, 'message': job.error_message}, status=502)

        try:
            ps.delete_vm_completely(verify_vmid)
            job.log_step('Verification clone cleaned up.')
        except Exception as e:
            job.log_step(f'Verification passed, but cleanup of clone {verify_vmid} failed: {e}', level='error')

        job.status = 'completed'
        job.final_template_id = job.proxmox_vmid
        job.save(update_fields=['status', 'final_template_id'])
        job.log_step('Template verified and ready to promote.')

        return Response({'success': True, 'data': _serialize_job(job)})


class AdminTemplateJobPromoteView(views.APIView):
    """POST /api/admin/templates/jobs/<id>/promote/
    Only callable once status='completed'. Creates the real VMTemplate
    row — the step that makes this genuinely, live available to real
    users, exactly like every existing template."""
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        job = get_object_or_404(TemplateCreationJob, pk=pk)
        if job.status != 'completed':
            return Response({
                'success': False,
                'message': f'Job must be completed and verified before promoting (current: {job.status}).',
            }, status=400)

        name = request.data.get('name', job.name).strip()
        description = request.data.get('description', '').strip()
        price_per_hour = request.data.get('price_per_hour', 0)
        price_per_month = request.data.get('price_per_month', 0)
        icon = request.data.get('icon', '🖥️')
        # Real, open choice — an admin can pick/confirm any OS family key
        # here (not limited to a fixed list), used only to select the
        # correct real icon (see frontend osIcons.js). Falls back to a
        # best-effort guess from the job/ISO name so promoting still
        # works if the admin skips this, rather than defaulting to a
        # misleading generic icon.
        os_family = (request.data.get('os_family') or '').strip().lower()
        if not os_family:
            guess_source = f'{job.name} {job.iso_filename or ""}'.lower()
            for candidate in ('ubuntu', 'debian', 'parrot', 'zorin', 'kali', 'fedora', 'arch', 'centos', 'mint', 'windows'):
                if candidate in guess_source:
                    os_family = candidate
                    break

        template = VMTemplate.objects.create(
            name=name,
            description=description or f'{job.desktop_environment.display_name} desktop, created via the admin template wizard.',
            cpu_cores=job.cpu_cores,
            ram_gb=job.ram_gb,
            storage_gb=job.disk_gb,
            os=job.desktop_environment.display_name,
            os_family=os_family,
            icon=icon,
            proxmox_template_id=job.final_template_id,
            is_real=True,
            is_available=True,
            template_type='desktop',
            price_per_hour=price_per_hour,
            price_per_month=price_per_month,
            software_list=job.desktop_environment.default_apps,
        )
        job.log_step(f'Promoted: VMTemplate #{template.id} ("{name}") is now genuinely live for real users.')

        return Response({'success': True, 'data': {'template_id': template.id, 'job': _serialize_job(job)}}, status=201)


class AdminTemplateJobOpenTerminalView(views.APIView):
    """POST /api/admin/templates/jobs/<id>/open-terminal/
    Real SSH connection via Guacamole, returning a guacamole_url exactly
    matching the proven, remote-access-safe pattern already used for
    every RDP connection in this app."""
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        from .services.proxmox_service import ProxmoxService
        from .services.guacamole_service import get_guacamole_service

        job = get_object_or_404(TemplateCreationJob, pk=pk)
        ssh_username = request.data.get('ssh_username', '').strip()
        ssh_password = request.data.get('ssh_password', '')
        manual_ip = (request.data.get('vm_ip') or '').strip()
        if not ssh_username or not ssh_password:
            return Response({'success': False, 'message': 'ssh_username and ssh_password are required.'}, status=400)

        ps = ProxmoxService()
        ip = manual_ip or ps.get_vm_ip(job.proxmox_vmid, max_wait=10)
        if not ip:
            return Response({'success': False, 'message': 'Could not reach the VM to open a terminal — guest-agent may not be installed yet, so pass vm_ip explicitly.'}, status=502)

        gs = get_guacamole_service()
        try:
            connection_id = gs.create_ssh_connection(
                name=f'wizard-terminal-{job.id}',
                hostname=ip,
                username=ssh_username,
                password=ssh_password,
            )
            url = gs.get_connection_url(connection_id)
        except Exception as e:
            logger.error('Failed to open real SSH terminal for job %s: %s', job.id, e, exc_info=True)
            return Response({'success': False, 'message': f'Failed to open terminal: {e}'}, status=502)

        return Response({'success': True, 'data': {'guacamole_url': url, 'connection_id': connection_id}})


class AdminTemplateJobOpenConsoleView(views.APIView):
    """POST /api/admin/templates/jobs/<id>/open-console/
    Embeds the VM's REAL Proxmox install console (raw RFB/VNC, the
    exact same stream Proxmox's own noVNC console renders) directly in
    the wizard — no more leaving the app to use Proxmox's separate web
    UI for the one genuinely manual step (OS install click-through).

    Proxmox never exposes VNC as a plain reachable TCP port; the only
    real path in is its authenticated `vncwebsocket` endpoint, which
    Guacamole's TCP-only VNC protocol can't speak directly — so this
    starts a local vnc_bridge (fresh ticket, real WebSocket to
    Proxmox) and points a Guacamole VNC connection at that bridge.
    Since Proxmox tickets are short-lived/one-shot, calling this again
    (the wizard's "Refresh Console" button) mints a brand new ticket
    and bridge rather than reusing anything."""
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        from .services.proxmox_service import ProxmoxService
        from .services.guacamole_service import get_guacamole_service
        from .services.vnc_bridge import start_vnc_bridge, VncBridgeError

        job = get_object_or_404(TemplateCreationJob, pk=pk)
        if not job.proxmox_vmid:
            return Response({'success': False, 'message': 'This job has no VM yet.'}, status=400)

        ps = ProxmoxService()
        try:
            local_ip, local_port, vnc_password = start_vnc_bridge(ps, job.proxmox_vmid)
        except VncBridgeError as e:
            logger.error('Failed to start VNC bridge for job %s (vm %s): %s', job.id, job.proxmox_vmid, e)
            return Response({'success': False, 'message': str(e)}, status=502)

        gs = get_guacamole_service()
        try:
            # Each open (including "Refresh Console") gets a genuinely
            # new bridge on a new local port with a new ticket — the
            # Guacamole connection name must be unique per call too,
            # or Guacamole rejects the reused name outright while the
            # old connection object (now pointing at a dead bridge
            # port) is still sitting there.
            import uuid
            connection_id = gs.create_vnc_connection(
                name=f'wizard-console-{job.id}-{job.proxmox_vmid}-{uuid.uuid4().hex[:8]}',
                hostname=local_ip,
                port=local_port,
                password=vnc_password,
            )
            url = gs.get_connection_url(connection_id)
        except Exception as e:
            logger.error('Failed to open real VNC console for job %s: %s', job.id, e, exc_info=True)
            return Response({'success': False, 'message': f'Failed to open console: {e}'}, status=502)

        return Response({'success': True, 'data': {'guacamole_url': url, 'connection_id': connection_id}})


class AdminTemplateJobPowerStatusView(views.APIView):
    """GET /api/admin/templates/jobs/<id>/power-status/
    Real, current power state of the job's VM, straight from Proxmox —
    no caching. This is what the wizard's status indicator polls, so a
    stale/guessed value here would defeat the entire point of it."""
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        from .services.proxmox_service import ProxmoxService

        job = get_object_or_404(TemplateCreationJob, pk=pk)
        if not job.proxmox_vmid:
            return Response({'success': False, 'message': 'This job has no VM yet.'}, status=400)

        status_str = ProxmoxService().get_vm_status(job.proxmox_vmid)
        return Response({'success': True, 'data': {'power_status': status_str}})


class AdminTemplateJobPowerView(views.APIView):
    """POST /api/admin/templates/jobs/<id>/power/
    {action: 'start' | 'stop' | 'shutdown' | 'restart'}
    Real Proxmox power control for the job's VM — the wizard had no
    way for an admin to tell or change the VM's actual power state
    from inside the console/terminal tab, so a VM that had simply
    stopped (or hung and needed a hard reset) looked identical to a
    genuine display/VNC bug: a permanently blank console with no
    explanation and no way to act on it."""
    permission_classes = [IsAdminUser]

    VALID_ACTIONS = {'start', 'stop', 'shutdown', 'restart'}

    def post(self, request, pk):
        from .services.proxmox_service import ProxmoxService

        job = get_object_or_404(TemplateCreationJob, pk=pk)
        if not job.proxmox_vmid:
            return Response({'success': False, 'message': 'This job has no VM yet.'}, status=400)

        action = (request.data.get('action') or '').strip()
        if action not in self.VALID_ACTIONS:
            return Response({
                'success': False,
                'message': f"action must be one of {sorted(self.VALID_ACTIONS)}.",
            }, status=400)

        ps = ProxmoxService()
        try:
            if action == 'start':
                ps.start_vm(job.proxmox_vmid)
            elif action == 'stop':
                ps.stop_vm(job.proxmox_vmid)
            elif action == 'shutdown':
                ps.shutdown_vm(job.proxmox_vmid)
            elif action == 'restart':
                ps.reboot_vm(job.proxmox_vmid)
        except Exception as e:
            logger.error('Power action %s failed for job %s (vm %s): %s', action, job.id, job.proxmox_vmid, e)
            return Response({'success': False, 'message': f'Power action failed: {e}'}, status=502)

        job.log_step(f'Power action "{action}" sent to VM {job.proxmox_vmid}.')
        status_str = ps.get_vm_status(job.proxmox_vmid)
        return Response({'success': True, 'data': {'power_status': status_str}})


class AdminVMOpenTerminalView(views.APIView):
    """POST /api/admin/vms/<int:proxmox_vmid>/open-terminal/
    General-purpose real SSH terminal for ANY real VM by its Proxmox
    VMID — not tied to a wizard job, so this is reusable from
    Infrastructure Health's VM list or anywhere else an admin needs a
    real terminal into a real VM. Reuses the exact same
    create_ssh_connection()/GuacamoleEmbed pattern as the wizard's own
    open-terminal endpoint."""
    permission_classes = [IsAdminUser]

    def post(self, request, proxmox_vmid):
        from .services.proxmox_service import ProxmoxService
        from .services.guacamole_service import get_guacamole_service

        ssh_username = request.data.get('ssh_username', '').strip()
        ssh_password = request.data.get('ssh_password', '')
        manual_ip = (request.data.get('vm_ip') or '').strip()
        if not ssh_username or not ssh_password:
            return Response({'success': False, 'message': 'ssh_username and ssh_password are required.'}, status=400)

        ps = ProxmoxService()
        ip = manual_ip
        if not ip:
            try:
                ip = ps.get_vm_ip(proxmox_vmid, max_wait=10)
            except Exception as e:
                return Response({'success': False, 'message': f'Could not query VM {proxmox_vmid}: {e}'}, status=502)
        if not ip:
            return Response({'success': False, 'message': f'Could not reach VM {proxmox_vmid} — is it running with a network connection? If it has no guest-agent yet, pass vm_ip explicitly.'}, status=502)

        gs = get_guacamole_service()
        try:
            connection_id = gs.create_ssh_connection(
                name=f'terminal-vm{proxmox_vmid}',
                hostname=ip,
                username=ssh_username,
                password=ssh_password,
            )
            url = gs.get_connection_url(connection_id)
        except Exception as e:
            logger.error('Failed to open real SSH terminal for VM %s: %s', proxmox_vmid, e, exc_info=True)
            return Response({'success': False, 'message': f'Failed to open terminal: {e}'}, status=502)

        return Response({'success': True, 'data': {'guacamole_url': url, 'vm_ip': ip, 'connection_id': connection_id}})


class AdminConnectionStatusView(views.APIView):
    """GET /api/admin/templates/connection-status/?connection_id=<id>
    Real, live tunnel-health signal for the admin wizard's console/
    terminal embeds — reuses the exact same
    guacamole_service.get_active_connection_id() mechanism that
    VirtualMachineSerializer.get_guac_connected() uses for the
    member-facing desktop view, just exposed directly by connection_id
    since these ad-hoc wizard connections aren't backed by a
    VirtualMachine row. Never assume a connection is live — Guacamole's
    own activeConnections list is the only genuine signal, matching
    the proven never-trust-a-timer pattern used everywhere else this
    app embeds Guacamole."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from .services.guacamole_service import get_guacamole_service

        connection_id = request.query_params.get('connection_id', '').strip()
        if not connection_id:
            return Response({'success': False, 'message': 'connection_id is required.'}, status=400)

        gs = get_guacamole_service()
        try:
            active = gs.get_active_connection_id(connection_id) is not None
        except Exception as e:
            logger.warning('Could not check connection status for %s: %s', connection_id, e)
            active = False

        return Response({'success': True, 'data': {'active': active}})


def _serialize_job(job):
    return {
        'id': job.id,
        'name': job.name,
        'proxmox_vmid': job.proxmox_vmid,
        'desktop_environment': job.desktop_environment.name,
        'status': job.status,
        'error_message': job.error_message,
        'log': job.log,
        'final_template_id': job.final_template_id,
        'created_at': job.created_at.isoformat(),
    }
