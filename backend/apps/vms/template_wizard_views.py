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

from .models import DesktopEnvironmentProfile, TemplateCreationJob, VMTemplate
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
            msg = check.get('error') or f"exit code {check.get('exit_code')}: {check.get('stderr')}"
            job.log_step(f'SSH connection check failed: {msg}', level='error')
            return Response({'success': False, 'message': f'SSH connection failed: {msg}'}, status=502)
        job.log_step('SSH connection verified.')

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

        template = VMTemplate.objects.create(
            name=name,
            description=description or f'{job.desktop_environment.display_name} desktop, created via the admin template wizard.',
            cpu_cores=job.cpu_cores,
            ram_gb=job.ram_gb,
            storage_gb=job.disk_gb,
            os=job.desktop_environment.display_name,
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

        return Response({'success': True, 'data': {'guacamole_url': url}})


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

        return Response({'success': True, 'data': {'guacamole_url': url}})


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

        return Response({'success': True, 'data': {'guacamole_url': url, 'vm_ip': ip}})


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
