"""Proxmox <-> Database reconciliation.

This addresses a real, recurring problem found multiple times during
today's audits: real Proxmox VMs with no corresponding tracked DB record
(usually left behind by a failed/partial cleanup), and DB records that
still claim a VM is 'running' when the real VM in Proxmox is long gone
(confirmed real example found in today's audit: VirtualMachine id 203,
proxmox_vm_id 9024, owner vfmakota@gmail.com, status='running' in the DB
with no matching VM in real Proxmox output at all).

Both directions are compared against REAL Proxmox API state, not
assumptions — this is meant to be run on demand from the admin panel,
not silently trusted.
"""
import logging

from django.utils import timezone as dj_timezone

from apps.vms.services.proxmox_service import get_proxmox_service
from apps.vms.models import VirtualMachine, VMTemplate

logger = logging.getLogger(__name__)

# Real, confirmed infrastructure/template VM IDs as of today's audit —
# Guacamole itself (200, a running service VM, not Proxmox-template-
# flagged so it wouldn't be caught by the `template` check below) plus
# the golden templates (9000, 9010, 9022, 9026 — the last two of which
# ARE also flagged `template: 1` in real Proxmox output, so excluding
# them here is defense-in-depth, not the only thing keeping them out).
KNOWN_INFRA_IDS = {200, 9000, 9010, 9022, 9026}


def _has_live_tracked_record(vmid):
    """True if this vmid has a real, LIVE tracked record - i.e. someone
    actively owns/relies on it (status running/stopped/provisioning/
    suspended). A record stuck in 'error' does NOT count as live: it
    represents a genuinely broken, abandoned provisioning attempt, not a
    real VM anyone is using - confirmed with real data (VM 9028,
    DB id 101, status='error', owner denyjoefx@gmail.com, no linked
    Workspace, sitting untouched). Excluding 'error' here is what lets
    the reconciliation tool actually clean these up instead of refusing
    forever because a dead DB row happens to still exist."""
    return VirtualMachine.objects.exclude(status__in=['deleted', VirtualMachine.Status.ERROR]).filter(proxmox_vm_id=vmid).exists()


def get_proxmox_drift_report():
    """Compare real Proxmox VM list against real DB records.

    Returns:
        {
            'orphaned_in_proxmox': [ {vmid, name, status, uptime}, ... ],
                # A real VM exists in Proxmox with no matching
                # non-deleted DB record at all.
            'stale_in_db': [ {id, proxmox_vm_id, name, owner, status}, ... ],
                # A DB record claims the VM is running, but the real VM
                # genuinely no longer exists in Proxmox.
            'healthy_count': int,
            'checked_at': isoformat str,
        }
    """
    ps = get_proxmox_service()
    real_vms = ps.proxmox.nodes(ps.node).qemu.get()
    real_vm_ids_all = {v['vmid'] for v in real_vms}

    real_vm_ids = {
        v['vmid'] for v in real_vms
        if v['vmid'] not in KNOWN_INFRA_IDS
        and not v.get('template')
    }

    # Real audit finding (VM 9028): a VirtualMachine record stuck in
    # 'error' status with no linked Workspace is just as genuinely
    # abandoned as having no DB record at all - excluding only
    # 'deleted' here meant a broken error-state row could permanently
    # block real cleanup of its Proxmox VM. See _has_live_tracked_record.
    tracked_vm_ids = set(
        VirtualMachine.objects
        .exclude(status__in=['deleted', VirtualMachine.Status.ERROR])
        .exclude(proxmox_vm_id__isnull=True)
        .values_list('proxmox_vm_id', flat=True)
    )

    orphaned_ids = real_vm_ids - tracked_vm_ids

    orphaned_details = []
    for vmid in orphaned_ids:
        vm_info = next(v for v in real_vms if v['vmid'] == vmid)
        has_error_record = VirtualMachine.objects.filter(proxmox_vm_id=vmid, status=VirtualMachine.Status.ERROR).exists()
        orphaned_details.append({
            'vmid': vmid,
            'name': vm_info.get('name'),
            'status': vm_info.get('status'),
            'uptime': vm_info.get('uptime'),
            'has_error_record': has_error_record,
        })
    orphaned_details.sort(key=lambda d: d['vmid'])

    # Stale-in-DB check — DB thinks it's alive, real Proxmox disagrees.
    # Real audit finding: VirtualMachine.owner is already a direct FK on
    # the model (not reached via a nonexistent db_vm.workspace shortcut),
    # used directly here.
    stale_records = []
    for db_vm in VirtualMachine.objects.filter(status='running').exclude(proxmox_vm_id__isnull=True):
        if db_vm.proxmox_vm_id not in real_vm_ids_all:
            stale_records.append({
                'id': db_vm.id,
                'proxmox_vm_id': db_vm.proxmox_vm_id,
                'name': db_vm.name,
                'owner': db_vm.owner.email if db_vm.owner else 'unknown',
                'status': db_vm.status,
            })
    stale_records.sort(key=lambda d: d['id'])

    return {
        'orphaned_in_proxmox': orphaned_details,
        'stale_in_db': stale_records,
        'healthy_count': len(real_vm_ids) - len(orphaned_ids),
        'checked_at': dj_timezone.now().isoformat(),
    }


def resolve_orphan(vmid, action, admin_user, owner_email=None, template_id=None):
    """Resolve a real Proxmox-orphaned VM.

    action='delete': genuinely deletes the VM from Proxmox using the
        proven delete_vm_completely() method.
    action='ignore': the admin has confirmed this VM is intentional
        (e.g. a manually-created test VM) — creates a real, tracked
        VirtualMachine record for it instead of deleting it, so it
        stops showing up as an orphan on future checks.
    """
    ps = get_proxmox_service()

    if action == 'delete':
        # Confirm it's still a real, genuine orphan right before deleting
        # — don't trust a stale report from a prior page load. Real,
        # confirmed case that motivated this exact re-check: an admin
        # clicked "Ignore" on VM 9030 (creating a real, live tracked
        # record), then also clicked "Delete" on the same still-visible
        # row from before the page refreshed - this check is what must
        # correctly refuse that second click.
        real_vms = ps.proxmox.nodes(ps.node).qemu.get()
        real_ids = {v['vmid'] for v in real_vms}
        if vmid not in real_ids:
            return {'success': True, 'message': f'VM {vmid} already gone from Proxmox.'}

        if _has_live_tracked_record(vmid):
            return {'success': False, 'message': f'VM {vmid} is now tracked in the database as a real, live/owned record. Refusing to delete it. Refresh the check and use the Workspaces page for this VM instead.'}

        ps.delete_vm_completely(vmid)

        # Real audit finding (VM 9028): if the only DB record(s) for this
        # vmid were stuck in 'error' with no linked Workspace, the real
        # Proxmox VM they pointed at is now genuinely gone too - soft-
        # delete them so they stop cluttering the Workspaces "Error" tab
        # with a row for a VM that no longer exists anywhere.
        cleaned = VirtualMachine.objects.filter(proxmox_vm_id=vmid, status=VirtualMachine.Status.ERROR).update(status=VirtualMachine.Status.DELETED)

        logger.info('Admin %s deleted orphaned Proxmox VM %s (also soft-deleted %d stale error DB record(s))', admin_user.email, vmid, cleaned)
        return {'success': True, 'message': f'VM {vmid} deleted from Proxmox.' + (f' Also cleaned up {cleaned} stale error record(s).' if cleaned else '')}

    elif action == 'ignore':
        owner = admin_user
        if owner_email:
            from apps.users.models import User
            try:
                owner = User.objects.get(email=owner_email)
            except User.DoesNotExist:
                return {'success': False, 'message': f'No user found with email {owner_email}.'}

        template = None
        if template_id:
            template = VMTemplate.objects.filter(id=template_id).first()
            if not template:
                return {'success': False, 'message': f'No template found with id {template_id}.'}
        else:
            template = VMTemplate.objects.filter(is_real=True).first()
        if not template:
            return {'success': False, 'message': 'No real VMTemplate exists to attach this record to.'}

        real_vms = ps.proxmox.nodes(ps.node).qemu.get()
        vm_info = next((v for v in real_vms if v['vmid'] == vmid), None)
        if not vm_info:
            return {'success': False, 'message': f'VM {vmid} no longer exists in Proxmox.'}

        real_status = vm_info.get('status')
        mapped_status = VirtualMachine.Status.RUNNING if real_status == 'running' else VirtualMachine.Status.STOPPED

        existing = VirtualMachine.objects.exclude(status='deleted').filter(proxmox_vm_id=vmid).first()
        if existing:
            if existing.status == VirtualMachine.Status.ERROR:
                # This vmid's only record was a dead, abandoned error row —
                # "ignore" here means the admin has confirmed the real VM
                # is intentional, so revive the record to reflect real
                # Proxmox state instead of leaving it stuck in 'error'
                # forever (which would otherwise keep it flagged as an
                # orphan-cleanup candidate on every future check).
                existing.status = mapped_status
                existing.save(update_fields=['status'])
                logger.info('Admin %s revived error-state VirtualMachine %s (vmid %s) to %s via ignore', admin_user.email, existing.id, vmid, mapped_status)
                return {'success': True, 'message': f'VM {vmid} was stuck in a dead error record. Revived as VirtualMachine {existing.id} ({mapped_status}).'}
            return {'success': True, 'message': f'VM {vmid} is already tracked (DB id {existing.id}).'}

        vm = VirtualMachine.objects.create(
            template=template,
            owner=owner,
            name=vm_info.get('name') or f'manual-{vmid}',
            status=mapped_status,
            proxmox_vm_id=vmid,
            notes='Marked "ignore" via the Infrastructure Health reconciliation tool. A real, tracked record was created so this VM stops appearing as an orphan.',
        )
        logger.info('Admin %s marked Proxmox VM %s as ignored/tracked (new VirtualMachine id %s)', admin_user.email, vmid, vm.id)
        return {'success': True, 'message': f'VM {vmid} is now tracked as VirtualMachine {vm.id}.'}

    return {'success': False, 'message': f'Unknown action: {action}'}


def resolve_stale(db_id, action, admin_user):
    """Resolve a DB record that claims 'running' but the real VM is gone.

    action='mark_stopped': keep the record, but correct its status so it
        stops lying about being a live, running VM.
    action='delete_record': the record is worthless (nothing real backs
        it) — mark it 'deleted' (soft delete, consistent with how every
        other deletion path in this app works, per the real audit
        finding that Workspace/VirtualMachine both use a 'deleted'
        status rather than hard-deleting rows).
    """
    try:
        db_vm = VirtualMachine.objects.get(id=db_id)
    except VirtualMachine.DoesNotExist:
        return {'success': False, 'message': f'No VirtualMachine with id {db_id}.'}

    # Re-confirm it's still genuinely stale before touching it.
    ps = get_proxmox_service()
    real_vms = ps.proxmox.nodes(ps.node).qemu.get()
    real_ids = {v['vmid'] for v in real_vms}
    if db_vm.proxmox_vm_id in real_ids:
        return {'success': False, 'message': f'VM {db_vm.proxmox_vm_id} genuinely exists in Proxmox again. Refusing to touch a real, live record. Refresh the check.'}

    if action == 'mark_stopped':
        db_vm.status = VirtualMachine.Status.STOPPED
        db_vm.stopped_at = db_vm.stopped_at or dj_timezone.now()
        db_vm.save()
        logger.info('Admin %s marked stale VirtualMachine %s as stopped', admin_user.email, db_id)
        return {'success': True, 'message': f'VirtualMachine {db_id} marked stopped.'}

    elif action == 'delete_record':
        db_vm.status = VirtualMachine.Status.DELETED
        db_vm.save()
        logger.info('Admin %s soft-deleted stale VirtualMachine %s record', admin_user.email, db_id)
        return {'success': True, 'message': f'VirtualMachine {db_id} record removed.'}

    return {'success': False, 'message': f'Unknown action: {action}'}
