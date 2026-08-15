"""Activity-based idle-workspace detection and auto-deletion.

Staged on a rolling window measured from Workspace.last_accessed_at (bumped
by every genuine launch path — see apps/vms/workspace_views.py::_perform_launch
and apps/vms/views.py::VMStartView). Deliberately NOT payment-based on its
own: a user who launches every day never goes idle, regardless of whether
they've paid for hours, a subscription, or nothing at all.

Workspaces with an active TemplateSubscription or a positive
WorkspaceHoursBalance for that specific template are exempt from warnings
and deletion entirely, no matter how idle — only genuinely unpaid, unused
workspaces are eligible for auto-deletion. This is checked fresh on every
run, so a workspace becomes exempt the moment it has an active subscription
or balance, and re-enters the pipeline if that lapses.
"""
import logging

from django.utils import timezone
from django.db.models import Exists, OuterRef
from datetime import timedelta

logger = logging.getLogger(__name__)


def _exclude_exempt_workspaces(queryset, now):
    """Exclude workspaces whose owner has an active subscription or a
    positive hours balance for that workspace's specific template."""
    from apps.vms.models import TemplateSubscription, WorkspaceHoursBalance

    active_subscription = TemplateSubscription.objects.filter(
        user=OuterRef('owner'), template=OuterRef('vm_template'),
        is_active=True, expires_at__gt=now,
    )
    positive_balance = WorkspaceHoursBalance.objects.filter(
        user=OuterRef('owner'), template=OuterRef('vm_template'),
        hours_remaining__gt=0,
    )
    return queryset.annotate(
        has_active_subscription=Exists(active_subscription),
        has_positive_balance=Exists(positive_balance),
    ).filter(has_active_subscription=False, has_positive_balance=False)


def send_idle_warning(workspace, notification_type, days_remaining):
    from apps.notifications.services import notify

    messages = {
        'first_warning': (
            f"Your workspace '{workspace.name}' hasn't been used in a while. "
            f"It will be automatically deleted in {days_remaining} days if not used again."
        ),
        'final_warning': (
            f"Your workspace '{workspace.name}' will be deleted tomorrow unless you use it."
        ),
        'deleted': (
            f"Your workspace '{workspace.name}' was automatically deleted due to prolonged inactivity."
        ),
    }

    notify(
        user=workspace.owner,
        title="Workspace Deleted" if notification_type == 'deleted' else "Workspace Inactivity",
        message=messages[notification_type],
        notification_type='workspace_idle',
    )


def check_and_process_idle_workspaces():
    """
    Returns a dict summary of what was done:
    {
        'first_warnings_sent': int,
        'final_warnings_sent': int,
        'deleted': int,
        'errors': list,
    }
    """
    from apps.vms.models import Workspace
    from apps.users.models import SystemConfig

    now = timezone.now()
    warning_days = int(SystemConfig.get('workspace_idle_warning_days', '23'))
    final_warning_days = int(SystemConfig.get('workspace_idle_final_warning_days', '29'))
    deletion_days = int(SystemConfig.get('workspace_idle_deletion_days', '30'))

    result = {
        'first_warnings_sent': 0,
        'final_warnings_sent': 0,
        'deleted': 0,
        'errors': [],
    }

    warning_cutoff = now - timedelta(days=warning_days)
    final_cutoff = now - timedelta(days=final_warning_days)
    delete_cutoff = now - timedelta(days=deletion_days)

    # ── FIRST WARNING ────────────────────────────────────────────────────
    candidates_for_first_warning = Workspace.objects.filter(
        last_accessed_at__lte=warning_cutoff,
        last_accessed_at__gt=final_cutoff,
        status__in=['active', 'stopped'],
    ).exclude(
        idle_notifications__notification_type='first_warning'
    )
    candidates_for_first_warning = _exclude_exempt_workspaces(candidates_for_first_warning, now)

    for ws in candidates_for_first_warning:
        try:
            send_idle_warning(ws, 'first_warning', days_remaining=deletion_days - warning_days)
            from apps.vms.models import WorkspaceIdleNotification
            WorkspaceIdleNotification.objects.create(workspace=ws, notification_type='first_warning')
            result['first_warnings_sent'] += 1
        except Exception as e:
            result['errors'].append(f'{ws.id}: {str(e)}')

    # ── FINAL WARNING ────────────────────────────────────────────────────
    candidates_for_final_warning = Workspace.objects.filter(
        last_accessed_at__lte=final_cutoff,
        last_accessed_at__gt=delete_cutoff,
        status__in=['active', 'stopped'],
    ).exclude(
        idle_notifications__notification_type='final_warning'
    )
    candidates_for_final_warning = _exclude_exempt_workspaces(candidates_for_final_warning, now)

    for ws in candidates_for_final_warning:
        try:
            send_idle_warning(ws, 'final_warning', days_remaining=deletion_days - final_warning_days)
            from apps.vms.models import WorkspaceIdleNotification
            WorkspaceIdleNotification.objects.create(workspace=ws, notification_type='final_warning')
            result['final_warnings_sent'] += 1
        except Exception as e:
            result['errors'].append(f'{ws.id}: {str(e)}')

    # ── ACTUAL DELETION ──────────────────────────────────────────────────
    candidates_for_deletion = Workspace.objects.filter(
        last_accessed_at__lte=delete_cutoff,
        status__in=['active', 'stopped'],
    )
    candidates_for_deletion = _exclude_exempt_workspaces(candidates_for_deletion, now)

    for ws in candidates_for_deletion:
        try:
            if ws.vm and ws.vm.proxmox_vm_id:
                from apps.vms.services.proxmox_service import ProxmoxService
                ps = ProxmoxService()
                ps.delete_vm_completely(ws.vm.proxmox_vm_id)

            if ws.vm and ws.vm.guacamole_connection_id:
                from apps.vms.services.guacamole_service import GuacamoleService
                gs = GuacamoleService()
                gs.authenticate()
                gs.delete_connection(ws.vm.guacamole_connection_id)

            send_idle_warning(ws, 'deleted', days_remaining=0)

            if ws.vm:
                ws.vm.delete()
            ws.delete()

            result['deleted'] += 1
        except Exception as e:
            logger.error(f'Failed to delete idle workspace {ws.id}: {str(e)}', exc_info=True)
            result['errors'].append(f'{ws.id}: {str(e)}')

    return result
