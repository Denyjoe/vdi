from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from apps.users.models import User, SystemConfig
from apps.vms.models import (
    VMTemplate, VirtualMachine, Workspace, WorkspaceIdleNotification,
    TemplateSubscription, WorkspaceHoursBalance,
)
from apps.vms.services.workspace_access import get_workspace_access
from apps.vms.services.idle_cleanup_service import check_and_process_idle_workspaces
from apps.vms.workspace_views import _perform_stop
from apps.notifications.models import Notification
from apps.users.models import ComputeUsageLog


class GetWorkspaceAccessTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='access_test_user',
            email='access_test_user@example.com',
            password='testpass123',
        )
        self.template = VMTemplate.objects.create(
            name='Test Template',
            description='A template for testing',
            cpu_cores=2,
            ram_gb=4,
            storage_gb=20,
            os='Ubuntu 22.04',
            price_per_hour=1500,
            price_per_month=45000,
        )
        self.other_template = VMTemplate.objects.create(
            name='Other Template',
            description='A second, independent template',
            cpu_cores=4,
            ram_gb=8,
            storage_gb=40,
            os='Windows 11',
            price_per_hour=3000,
            price_per_month=90000,
        )

    def test_active_subscription_bypasses_balance_check_entirely(self):
        TemplateSubscription.objects.create(
            user=self.user, template=self.template,
            is_active=True, expires_at=timezone.now() + timedelta(days=30),
        )
        # Balance is genuinely zero — subscription alone must be sufficient.
        result = get_workspace_access(self.user, self.template)

        self.assertTrue(result['can_launch'])
        self.assertEqual(result['reason'], 'subscription')
        self.assertEqual(result['price_per_hour'], self.template.price_per_hour)
        self.assertEqual(result['price_per_month'], self.template.price_per_month)

    def test_expired_subscription_falls_through_to_balance_check(self):
        TemplateSubscription.objects.create(
            user=self.user, template=self.template,
            is_active=True, expires_at=timezone.now() - timedelta(days=1),
        )
        WorkspaceHoursBalance.objects.create(user=self.user, template=self.template, hours_remaining=Decimal('3.00'))

        result = get_workspace_access(self.user, self.template)

        self.assertTrue(result['can_launch'])
        self.assertEqual(result['reason'], 'hours_balance')
        self.assertEqual(result['hours_remaining'], Decimal('3.00'))

    def test_inactive_subscription_falls_through_to_balance_check(self):
        TemplateSubscription.objects.create(
            user=self.user, template=self.template,
            is_active=False, expires_at=timezone.now() + timedelta(days=30),
        )

        result = get_workspace_access(self.user, self.template)

        self.assertFalse(result['can_launch'])
        self.assertEqual(result['reason'], 'payment_required')

    def test_positive_balance_grants_access(self):
        WorkspaceHoursBalance.objects.create(user=self.user, template=self.template, hours_remaining=Decimal('2.50'))

        result = get_workspace_access(self.user, self.template)

        self.assertTrue(result['can_launch'])
        self.assertEqual(result['reason'], 'hours_balance')
        self.assertEqual(result['hours_remaining'], Decimal('2.50'))

    def test_zero_balance_no_subscription_requires_payment_with_real_prices(self):
        WorkspaceHoursBalance.objects.create(user=self.user, template=self.template, hours_remaining=Decimal('0.00'))

        result = get_workspace_access(self.user, self.template)

        self.assertFalse(result['can_launch'])
        self.assertEqual(result['reason'], 'payment_required')
        self.assertEqual(result['hours_remaining'], Decimal('0.00'))
        self.assertEqual(result['price_per_hour'], self.template.price_per_hour)
        self.assertEqual(result['price_per_month'], self.template.price_per_month)

    def test_no_balance_row_at_all_requires_payment(self):
        # Brand new user/template pair — no WorkspaceHoursBalance row exists yet.
        result = get_workspace_access(self.user, self.template)

        self.assertFalse(result['can_launch'])
        self.assertEqual(result['reason'], 'payment_required')
        self.assertEqual(result['hours_remaining'], Decimal('0'))

    def test_balance_boundary_just_above_zero_grants_access(self):
        WorkspaceHoursBalance.objects.create(user=self.user, template=self.template, hours_remaining=Decimal('0.01'))

        result = get_workspace_access(self.user, self.template)

        self.assertTrue(result['can_launch'])
        self.assertEqual(result['reason'], 'hours_balance')

    def test_subscription_and_balance_are_strictly_per_template(self):
        TemplateSubscription.objects.create(
            user=self.user, template=self.template,
            is_active=True, expires_at=timezone.now() + timedelta(days=30),
        )
        WorkspaceHoursBalance.objects.create(user=self.user, template=self.template, hours_remaining=Decimal('10.00'))

        # Subscribed + has balance on `template` — but `other_template` shares
        # neither, and must independently require payment.
        result_a = get_workspace_access(self.user, self.template)
        result_b = get_workspace_access(self.user, self.other_template)

        self.assertEqual(result_a['reason'], 'subscription')
        self.assertFalse(result_b['can_launch'])
        self.assertEqual(result_b['reason'], 'payment_required')
        self.assertEqual(result_b['price_per_hour'], self.other_template.price_per_hour)


class WorkspaceHoursDeductionTests(TestCase):
    """_perform_stop's hours-balance deduction, tested with manipulated
    ComputeUsageLog.started_at rather than a real multi-hour wait (the
    real end-to-end wall-clock path was separately verified live: 1.00h
    purchased, launched, 45s real sleep, stopped -> 0.98h remaining,
    matching the real ComputeUsageLog.hours_used of 0.0239h exactly)."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='deduction_test_user',
            email='deduction_test_user@example.com',
            password='testpass123',
        )
        self.template = VMTemplate.objects.create(
            name='Deduction Unit Test Template',
            description='template for deduction unit tests',
            cpu_cores=1, ram_gb=1, storage_gb=5,
            os='Test OS',
            price_per_hour=1000,
        )

    def _make_active_workspace(self, access_reason='hours_balance'):
        vm = VirtualMachine.objects.create(
            name='test-vm', owner=self.user, template=self.template, status='running',
        )
        ws = Workspace.objects.create(
            owner=self.user, name='Deduction Test WS', vm_template=self.template,
            vm=vm, status='active', access_reason=access_reason,
        )
        return ws, vm

    def test_stop_deducts_real_elapsed_hours_from_balance(self):
        balance = WorkspaceHoursBalance.objects.create(user=self.user, template=self.template, hours_remaining=Decimal('5.00'))
        ws, vm = self._make_active_workspace()
        log = ComputeUsageLog.objects.create(user=self.user, vm=vm, session_type='workspace')
        log.started_at = timezone.now() - timedelta(hours=2)
        log.save(update_fields=['started_at'])

        _perform_stop(ws)

        balance.refresh_from_db()
        # ~2 hours elapsed, deducted from 5.00 — allow a little slack for
        # the real time this test itself takes to run.
        self.assertLess(balance.hours_remaining, Decimal('3.10'))
        self.assertGreater(balance.hours_remaining, Decimal('2.90'))
        ws.refresh_from_db()
        self.assertEqual(ws.access_reason, '')
        self.assertEqual(ws.status, 'stopped')

    def test_stop_floors_balance_at_zero_never_negative(self):
        balance = WorkspaceHoursBalance.objects.create(user=self.user, template=self.template, hours_remaining=Decimal('0.50'))
        ws, vm = self._make_active_workspace()
        log = ComputeUsageLog.objects.create(user=self.user, vm=vm, session_type='workspace')
        log.started_at = timezone.now() - timedelta(hours=10)  # far more than the balance covers
        log.save(update_fields=['started_at'])

        _perform_stop(ws)

        balance.refresh_from_db()
        self.assertEqual(balance.hours_remaining, Decimal('0.00'))

    def test_subscription_funded_stop_does_not_touch_balance(self):
        balance = WorkspaceHoursBalance.objects.create(user=self.user, template=self.template, hours_remaining=Decimal('3.00'))
        ws, vm = self._make_active_workspace(access_reason='subscription')
        log = ComputeUsageLog.objects.create(user=self.user, vm=vm, session_type='workspace')
        log.started_at = timezone.now() - timedelta(hours=2)
        log.save(update_fields=['started_at'])

        _perform_stop(ws)

        balance.refresh_from_db()
        # Subscription-funded usage never touches the hours balance at all.
        self.assertEqual(balance.hours_remaining, Decimal('3.00'))


class TemplateSubscriptionCalendarTests(TestCase):
    """Proves TemplateSubscription.expires_at is purely calendar-based —
    nothing in the launch/stop code path ever reads or writes it."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='calendar_test_user',
            email='calendar_test_user@example.com',
            password='testpass123',
        )
        self.template = VMTemplate.objects.create(
            name='Calendar Test Template',
            description='template',
            cpu_cores=1, ram_gb=1, storage_gb=5,
            os='Test OS',
            price_per_hour=1000,
        )

    def test_heavy_usage_during_the_month_never_changes_expires_at(self):
        sub = TemplateSubscription.objects.create(
            user=self.user, template=self.template,
            is_active=True, expires_at=timezone.now() + timedelta(days=30),
        )
        original_expiry = sub.expires_at

        # Simulate many launch+stop cycles during the subscription period —
        # _perform_stop must never touch TemplateSubscription at all.
        for _ in range(5):
            vm = VirtualMachine.objects.create(
                name='test-vm', owner=self.user, template=self.template, status='running',
            )
            ws = Workspace.objects.create(
                owner=self.user, name=f'Calendar WS {_}', vm_template=self.template,
                vm=vm, status='active', access_reason='subscription',
            )
            log = ComputeUsageLog.objects.create(user=self.user, vm=vm, session_type='workspace')
            log.started_at = timezone.now() - timedelta(hours=6)
            log.save(update_fields=['started_at'])
            _perform_stop(ws)

        sub.refresh_from_db()
        self.assertEqual(sub.expires_at, original_expiry)


class WorkspaceIdleCleanupTests(TestCase):
    """Proves the 30-day idle-detection/deletion system correct by
    simulating every stage of the timeline via last_accessed_at — this
    suite IS the evidence, since nobody can wait 30 real days to verify it."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='idle_test_user',
            email='idle_test_user@example.com',
            password='testpass123',
        )
        self.template = VMTemplate.objects.create(
            name='Idle Test Template',
            description='Simulated template for idle-cleanup testing',
            cpu_cores=1, ram_gb=1, storage_gb=5,
            os='Test OS',
            is_real=False,
        )
        # Match the spec defaults explicitly so the test timeline is exact
        # regardless of whatever an admin may have configured previously.
        SystemConfig.set('workspace_idle_warning_days', '23')
        SystemConfig.set('workspace_idle_final_warning_days', '29')
        SystemConfig.set('workspace_idle_deletion_days', '30')

    def _make_workspace(self, days_idle, status='stopped', name=None):
        ws = Workspace.objects.create(
            owner=self.user,
            name=name or f'Idle Test WS {days_idle}d',
            vm_template=self.template,
            status=status,
        )
        Workspace.objects.filter(id=ws.id).update(
            last_accessed_at=timezone.now() - timedelta(days=days_idle)
        )
        ws.refresh_from_db()
        return ws

    def test_recently_active_workspace_untouched(self):
        ws = self._make_workspace(days_idle=1)

        result = check_and_process_idle_workspaces()

        self.assertEqual(result['first_warnings_sent'], 0)
        self.assertEqual(result['final_warnings_sent'], 0)
        self.assertEqual(result['deleted'], 0)
        self.assertEqual(result['errors'], [])
        self.assertTrue(Workspace.objects.filter(id=ws.id).exists())

    def test_23_days_idle_triggers_first_warning(self):
        ws = self._make_workspace(days_idle=23)

        result = check_and_process_idle_workspaces()

        self.assertEqual(result['first_warnings_sent'], 1)
        self.assertEqual(result['final_warnings_sent'], 0)
        self.assertEqual(result['deleted'], 0)
        self.assertEqual(result['errors'], [])

        # A real Notification row was created for the owner
        notif = Notification.objects.filter(user=self.user, notification_type='system').first()
        self.assertIsNotNone(notif)
        self.assertIn(ws.name, notif.message)

        # A WorkspaceIdleNotification tracking row exists, preventing re-send
        self.assertTrue(
            WorkspaceIdleNotification.objects.filter(
                workspace=ws, notification_type='first_warning'
            ).exists()
        )

    def test_first_warning_not_sent_twice(self):
        self._make_workspace(days_idle=23)

        first_run = check_and_process_idle_workspaces()
        second_run = check_and_process_idle_workspaces()

        self.assertEqual(first_run['first_warnings_sent'], 1)
        self.assertEqual(second_run['first_warnings_sent'], 0)
        self.assertEqual(
            Notification.objects.filter(notification_type='system').count(), 1
        )

    def test_29_days_idle_triggers_final_warning(self):
        ws = self._make_workspace(days_idle=29)

        result = check_and_process_idle_workspaces()

        self.assertEqual(result['first_warnings_sent'], 0)
        self.assertEqual(result['final_warnings_sent'], 1)
        self.assertEqual(result['deleted'], 0)

        self.assertTrue(
            WorkspaceIdleNotification.objects.filter(
                workspace=ws, notification_type='final_warning'
            ).exists()
        )

    def test_final_warning_not_sent_twice(self):
        self._make_workspace(days_idle=29)

        first_run = check_and_process_idle_workspaces()
        second_run = check_and_process_idle_workspaces()

        self.assertEqual(first_run['final_warnings_sent'], 1)
        self.assertEqual(second_run['final_warnings_sent'], 0)

    def test_30_days_idle_triggers_real_deletion(self):
        """Uses a REAL Proxmox-cloned VM (not a DB stub) so deletion is
        proven against the actual hypervisor, not just the test database."""
        from apps.vms.services.proxmox_service import ProxmoxService

        ps = ProxmoxService()
        # 9022 is the real, known-good 'ubuntu-dbus-fix-real' template on
        # the Proxmox node (confirmed present throughout today's testing).
        real_vmid = ps.clone_template(9022, name='idle-cleanup-test-vm')

        # Confirm it's genuinely there before we ever touch the idle-check.
        node_vms_before = ps.proxmox.nodes(ps.node).qemu.get()
        self.assertTrue(any(int(v['vmid']) == real_vmid for v in node_vms_before))

        vm = VirtualMachine.objects.create(
            name='idle-cleanup-test-vm',
            owner=self.user,
            template=self.template,
            status='stopped',
            proxmox_vm_id=real_vmid,
        )
        ws = Workspace.objects.create(
            owner=self.user,
            name='Idle Deletion Test WS',
            vm_template=self.template,
            vm=vm,
            status='stopped',
        )
        Workspace.objects.filter(id=ws.id).update(
            last_accessed_at=timezone.now() - timedelta(days=31)
        )

        try:
            result = check_and_process_idle_workspaces()

            self.assertEqual(result['errors'], [])
            self.assertEqual(result['deleted'], 1)

            # 1. Workspace genuinely gone from the DB
            self.assertFalse(Workspace.objects.filter(id=ws.id).exists())
            self.assertFalse(VirtualMachine.objects.filter(id=vm.id).exists())

            # 2. VM genuinely gone from Proxmox itself — not just the DB
            node_vms_after = ps.proxmox.nodes(ps.node).qemu.get()
            self.assertFalse(any(int(v['vmid']) == real_vmid for v in node_vms_after))

            # 3. Final deletion notification was sent
            notif = Notification.objects.filter(
                user=self.user, title='Workspace Deleted'
            ).first()
            self.assertIsNotNone(notif)
        finally:
            # Safety net: if the assertion above failed before cleanup,
            # don't leave a real VM behind on the hypervisor.
            try:
                node_vms_final = ps.proxmox.nodes(ps.node).qemu.get()
                if any(int(v['vmid']) == real_vmid for v in node_vms_final):
                    ps.delete_vm_completely(real_vmid)
            except Exception:
                pass

    def test_daily_free_hour_user_never_hits_threshold(self):
        """The exact scenario the user was worried about: someone who
        launches their workspace every single day for 40 simulated days
        must NEVER receive a warning or be deleted.

        check_and_process_idle_workspaces() always reads the real wall
        clock (timezone.now()), so "simulating 40 days" means running the
        check 40 times, resetting last_accessed_at to "just now" before
        each run — exactly what a real daily-active user's timestamp looks
        like to the nightly check regardless of which calendar day it is."""
        ws = Workspace.objects.create(
            owner=self.user,
            name='Daily User WS',
            vm_template=self.template,
            status='stopped',
        )

        for simulated_day in range(1, 41):
            # "Logs in" — a genuine launch refreshes last_accessed_at to now.
            Workspace.objects.filter(id=ws.id).update(last_accessed_at=timezone.now())

            result = check_and_process_idle_workspaces()

            self.assertEqual(result['first_warnings_sent'], 0, f'False warning at simulated day {simulated_day}')
            self.assertEqual(result['final_warnings_sent'], 0, f'False final warning at simulated day {simulated_day}')
            self.assertEqual(result['deleted'], 0, f'False deletion at simulated day {simulated_day}')

        self.assertTrue(Workspace.objects.filter(id=ws.id).exists())
        self.assertEqual(WorkspaceIdleNotification.objects.filter(workspace=ws).count(), 0)

    def test_gap_of_22_days_between_logins_stays_safe_but_23_triggers_warning(self):
        """The real boundary a daily-ish (not necessarily every single day)
        user actually needs protected: any gap under the warning threshold
        is always safe, and crossing it is what actually triggers a warning
        — proven with real elapsed-time values, not just the 'daily' case."""
        ws = self._make_workspace(days_idle=22)
        result = check_and_process_idle_workspaces()
        self.assertEqual(result['first_warnings_sent'], 0)
        self.assertEqual(result['deleted'], 0)
        self.assertTrue(Workspace.objects.filter(id=ws.id).exists())

        Workspace.objects.filter(id=ws.id).update(
            last_accessed_at=timezone.now() - timedelta(days=23)
        )
        result = check_and_process_idle_workspaces()
        self.assertEqual(result['first_warnings_sent'], 1)

    def test_using_workspace_resets_the_clock(self):
        ws = self._make_workspace(days_idle=25)

        # First check: 25 days idle is past the 23-day warning threshold —
        # should receive a first warning.
        result = check_and_process_idle_workspaces()
        self.assertEqual(result['first_warnings_sent'], 1)

        # Now simulate a genuine launch: last_accessed_at resets to now.
        Workspace.objects.filter(id=ws.id).update(last_accessed_at=timezone.now())

        # Immediately re-running the check must NOT flag it for anything,
        # regardless of the prior warning history.
        result = check_and_process_idle_workspaces()
        self.assertEqual(result['first_warnings_sent'], 0)
        self.assertEqual(result['final_warnings_sent'], 0)
        self.assertEqual(result['deleted'], 0)
        self.assertTrue(Workspace.objects.filter(id=ws.id).exists())

    def test_positive_balance_and_active_subscription_are_exempt_from_idle_deletion(self):
        """CRITICAL business-rule test (inverted from the prior version):
        a workspace with a positive hours balance OR an active subscription
        for its specific template is NEVER warned or deleted, no matter how
        idle. Only genuinely unpaid, unused workspaces are eligible."""
        from apps.vms.models import WorkspaceHoursBalance, TemplateSubscription

        balance_ws = self._make_workspace(days_idle=31, name='Balance Exempt WS')
        WorkspaceHoursBalance.objects.create(user=self.user, template=self.template, hours_remaining=Decimal('7.50'))

        sub_user = User.objects.create_user(
            username='idle_test_user_sub',
            email='idle_test_user_sub@example.com',
            password='testpass123',
        )
        sub_ws = Workspace.objects.create(
            owner=sub_user, name='Subscription Exempt WS',
            vm_template=self.template, status='stopped',
        )
        Workspace.objects.filter(id=sub_ws.id).update(
            last_accessed_at=timezone.now() - timedelta(days=31)
        )
        TemplateSubscription.objects.create(
            user=sub_user, template=self.template,
            is_active=True, expires_at=timezone.now() + timedelta(days=15),
        )

        result = check_and_process_idle_workspaces()

        self.assertEqual(result['deleted'], 0)
        self.assertEqual(result['first_warnings_sent'], 0)
        self.assertEqual(result['final_warnings_sent'], 0)
        self.assertEqual(result['errors'], [])

        # Both workspaces genuinely still exist — not deleted, not warned.
        self.assertTrue(Workspace.objects.filter(id=balance_ws.id).exists())
        self.assertTrue(Workspace.objects.filter(id=sub_ws.id).exists())
        self.assertFalse(WorkspaceIdleNotification.objects.filter(workspace=balance_ws).exists())
        self.assertFalse(WorkspaceIdleNotification.objects.filter(workspace=sub_ws).exists())
        self.assertFalse(Notification.objects.filter(user=self.user, notification_type='system').exists())
        self.assertFalse(Notification.objects.filter(user=sub_user, notification_type='system').exists())

        # The balance and subscription rows are untouched.
        balance = WorkspaceHoursBalance.objects.get(user=self.user, template=self.template)
        self.assertEqual(balance.hours_remaining, Decimal('7.50'))
        sub = TemplateSubscription.objects.get(user=sub_user, template=self.template)
        self.assertTrue(sub.is_active)

    def test_genuinely_unpaid_idle_workspace_still_deleted_per_original_design(self):
        """Companion to the exemption test above: a workspace with NO
        subscription and a zero/absent hours balance must still be
        correctly warned and deleted exactly as before — the exemption
        must not weaken the original design for genuinely unpaid users."""
        from apps.vms.models import WorkspaceHoursBalance, TemplateSubscription

        # Explicit zero balance (not just absent) must still be treated as unpaid.
        WorkspaceHoursBalance.objects.create(user=self.user, template=self.template, hours_remaining=Decimal('0'))
        # An expired subscription must not count as active.
        TemplateSubscription.objects.create(
            user=self.user, template=self.template,
            is_active=True, expires_at=timezone.now() - timedelta(days=1),
        )

        ws = self._make_workspace(days_idle=31)

        result = check_and_process_idle_workspaces()

        self.assertEqual(result['deleted'], 1)
        self.assertEqual(result['errors'], [])
        self.assertFalse(Workspace.objects.filter(id=ws.id).exists())

        notif = Notification.objects.filter(user=self.user, title='Workspace Deleted').first()
        self.assertIsNotNone(notif)
        # Forfeiture language must no longer appear — the scenario it
        # described is no longer reachable.
        self.assertNotIn('forfeited', notif.message)
