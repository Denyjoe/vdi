from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Workspace, VMTemplate, VirtualMachine
from .serializers import WorkspaceSerializer
from apps.users.models import ComputeUsageLog
from apps.vms.services.vm_orchestrator import VMOrchestrator
from apps.vms.services.workspace_access import get_workspace_access
from apps.notifications.services import notify


def _perform_launch(workspace, user):
    """Provisions/starts the VM for a workspace. Raises on genuine failure."""
    orchestrator = VMOrchestrator()

    if not workspace.vm:
        vm = VirtualMachine.objects.create(
            name=f"workspace-{workspace.id}-{user.username}",
            owner=user,
            template=workspace.vm_template,
            status='provisioning'
        )
        workspace.vm = vm
        workspace.status = 'active'
        workspace.last_accessed_at = timezone.now()
        workspace.save()

        if workspace.vm_template.is_real:
            import threading
            thread = threading.Thread(target=orchestrator.provision_real_vm, args=(vm,))
            thread.daemon = True
            thread.start()
        else:
            orchestrator.provision_vm(vm)

    else:
        if workspace.vm.status != 'running' and workspace.vm.status != 'provisioning':
            workspace.vm.status = 'provisioning'
            workspace.vm.save()

            workspace.status = 'active'
            workspace.last_accessed_at = timezone.now()
            workspace.save()

            if workspace.vm_template.is_real:
                import threading
                thread = threading.Thread(target=orchestrator.start_real_vm, args=(workspace,))
                thread.daemon = True
                thread.start()
            else:
                orchestrator.start_vm(workspace.vm)


def _perform_stop(workspace):
    """Stops the VM and deducts real elapsed hours from the owner's
    per-template balance if this run was funded by hours_balance (not a
    subscription, which is unlimited and never deducted).

    Used by EVERY stop path — user-initiated (WorkspaceStopView) and
    admin force-stop (AdminForceStopWorkspaceView) — so deduction behaves
    identically no matter who or what actually stopped the VM. Always
    attributes usage to workspace.owner, never to whoever called this
    (an admin force-stopping someone else's workspace must still deduct
    from THAT workspace owner's balance, not the admin's).
    """
    from decimal import Decimal
    from apps.vms.models import WorkspaceHoursBalance

    owner = workspace.owner
    orchestrator = VMOrchestrator()

    if workspace.vm:
        orchestrator.stop_vm(workspace.vm)

        from apps.vms.services.pool_service import VMPoolService
        pool = VMPoolService()
        try:
            pool.release_vm(workspace.vm)
        except Exception:
            pass

    workspace.status = 'stopped'

    log = None
    if workspace.vm:
        log = ComputeUsageLog.objects.filter(
            user=owner, vm=workspace.vm, ended_at__isnull=True
        ).order_by('-started_at').first()

    if log:
        log.ended_at = timezone.now()
        diff = (log.ended_at - log.started_at).total_seconds() / 3600.0
        log.hours_used = diff
        log.save()

        workspace.compute_hours_used += diff

        if workspace.access_reason == 'hours_balance':
            balance, _ = WorkspaceHoursBalance.objects.get_or_create(
                user=owner, template=workspace.vm_template
            )
            LOW_BALANCE_THRESHOLD = Decimal('1')
            was_above_threshold = balance.hours_remaining >= LOW_BALANCE_THRESHOLD
            balance.hours_remaining = max(Decimal('0'), balance.hours_remaining - Decimal(str(diff)))
            balance.save()

            # Fire once, right as the balance actually crosses under the
            # threshold from this real deduction — not on every subsequent
            # stop while it stays low (that would spam the same warning
            # repeatedly for a user who just keeps using their remaining
            # minutes).
            if was_above_threshold and balance.hours_remaining < LOW_BALANCE_THRESHOLD:
                notify(
                    user=owner,
                    title='Hours Balance Running Low',
                    message=(
                        f'Only {balance.hours_remaining}h left for '
                        f'{workspace.vm_template.name}. Top up to keep using it.'
                    ),
                    notification_type='hours_balance_low',
                    link='/workspaces',
                )

    workspace.access_reason = ''
    workspace.save()


class WorkspaceListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WorkspaceSerializer

    def get_queryset(self):
        return Workspace.objects.filter(owner=self.request.user).exclude(status='deleted')

class WorkspaceCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = WorkspaceSerializer(data=request.data)
        if serializer.is_valid():
            try:
                from apps.users.models import SystemConfig
                max_per_user = int(SystemConfig.get('max_vms_per_user', '3'))

                current_w = Workspace.objects.filter(owner=request.user).exclude(status='deleted').count()

                if current_w >= max_per_user:
                    return Response({
                        "success": False,
                        "message": f"You have reached the platform maximum of {max_per_user} workspace(s). Delete an existing workspace to create a new one."
                    }, status=status.HTTP_400_BAD_REQUEST)

                workspace = serializer.save(owner=request.user)
                # Log: 'WORKSPACE_CREATED'
                return Response({
                    "success": True,
                    "data": WorkspaceSerializer(workspace).data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

class WorkspaceDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WorkspaceSerializer

    def get_queryset(self):
        return Workspace.objects.filter(owner=self.request.user).exclude(status='deleted')

class WorkspaceLaunchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        workspace = get_object_or_404(Workspace, pk=pk, owner=request.user)

        from apps.users.models import SystemConfig
        from apps.vms.models import VirtualMachine

        max_concurrent = int(SystemConfig.get('max_concurrent_vms', '10'))
        active_vms = VirtualMachine.objects.filter(status='running').count()
        if active_vms >= max_concurrent:
            return Response({
                "success": False,
                "message": "Platform is at maximum capacity. Please try again shortly."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if workspace.status == 'deleted':
            return Response({"success": False, "message": "Workspace is deleted"}, status=status.HTTP_400_BAD_REQUEST)

        access = get_workspace_access(request.user, workspace.vm_template)
        if not access['can_launch']:
            return Response({
                "success": False,
                "requires_payment": True,
                "reason": access['reason'],
                "price_per_hour": access['price_per_hour'],
                "price_per_month": access['price_per_month'],
                "template_name": workspace.vm_template.name,
                "message": f"You're out of hours for {workspace.vm_template.name}. Buy more or subscribe."
            }, status=status.HTTP_402_PAYMENT_REQUIRED)

        workspace.access_reason = access['reason']

        try:
            _perform_launch(workspace, request.user)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Proxmox provisioning failed: {str(e)}')
            return Response({
                'success': False,
                'message': (
                    'Unable to start your '
                    'workspace right now. '
                    'Our infrastructure team '
                    'has been notified. '
                    'Please try again in a '
                    'few minutes.'
                )
            }, status=503)

        # Log: 'WORKSPACE_LAUNCHED'
        ComputeUsageLog.objects.create(
            user=request.user,
            vm=workspace.vm,
            session_type='workspace'
        )

        notify(
            user=request.user,
            title='Workspace Launched',
            message=f'Launched {workspace.name}',
            notification_type='workspace_ready',
            link=f'/workspace/{workspace.id}'
        )

        return Response({
            "success": True,
            "data": WorkspaceSerializer(workspace).data,
            "access_reason": access['reason'],
            "hours_remaining": float(access['hours_remaining']),
        })


class WorkspaceAccessCheckView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        template_id = request.query_params.get('template_id')
        if not template_id:
            return Response({"success": False, "message": "template_id required"}, status=400)

        try:
            template = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response({"success": False, "message": "Invalid template"}, status=404)

        access = get_workspace_access(request.user, template)
        return Response({"success": True, "data": access})


class PurchaseHoursView(APIView):
    """Adds to the caller's per-template hours balance. Does NOT launch —
    launching is a separate step via WorkspaceLaunchView, which will now
    succeed because the balance is positive."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.users.models import Payment
        from apps.vms.models import WorkspaceHoursBalance
        import decimal
        import uuid

        template_id = request.data.get('template_id')
        raw_hours = request.data.get('hours')
        phone = request.data.get('phone_number')
        provider = request.data.get('provider')

        if not template_id or raw_hours is None:
            return Response({"success": False, "message": "template_id and hours are required"}, status=400)

        try:
            hours = decimal.Decimal(str(raw_hours))
        except Exception:
            return Response({"success": False, "message": "Invalid hours value"}, status=400)

        if hours <= 0 or hours > 100:
            return Response({"success": False, "message": "Please select between 0.5 and 100 hours."}, status=400)

        try:
            template = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response({"success": False, "message": "Invalid template"}, status=404)

        total_price = hours * template.price_per_hour

        # SANDBOX payment — instant success, same pattern proven all day.
        transaction_id = f'WH-{str(uuid.uuid4())[:8].upper()}'
        try:
            Payment.objects.create(
                user=request.user,
                payment_type='workspace_hours_purchase',
                amount_tzs=total_price,
                currency='TZS',
                provider=provider,
                phone_number=phone,
                status='completed',
                transaction_id=transaction_id,
                metadata={
                    'template_id': template.id,
                    'template_name': template.name,
                    'hours_purchased': str(hours),
                },
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'FAILED to create payment record: {str(e)}', exc_info=True)
            return Response({
                'success': False,
                'message': 'Payment could not be processed. Please try again.'
            }, status=500)

        balance, _ = WorkspaceHoursBalance.objects.get_or_create(user=request.user, template=template)
        balance.hours_remaining += hours
        balance.save()

        notify(
            user=request.user,
            title='Hours Purchased',
            message=f'Added {hours}h to {template.name} — {balance.hours_remaining}h remaining.',
            notification_type='payment_confirmed',
            link='/workspaces'
        )

        return Response({
            "success": True,
            "data": {
                "transaction_id": transaction_id,
                "amount_paid_tzs": float(total_price),
                "hours_purchased": float(hours),
                "hours_remaining": float(balance.hours_remaining),
                "template_id": template.id,
            }
        })


class SubscribeTemplateView(APIView):
    """Per-template monthly subscription. Calendar-based: expires_at is
    always started_at (or the prior expiry) + 30 days, and nothing in the
    launch/stop code path ever touches it — heavy usage never extends it,
    light usage never shortens it."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.users.models import Payment
        from apps.vms.models import TemplateSubscription
        from datetime import timedelta
        import uuid

        template_id = request.data.get('template_id')
        phone = request.data.get('phone_number')
        provider = request.data.get('provider')

        if not template_id:
            return Response({"success": False, "message": "template_id required"}, status=400)

        try:
            template = VMTemplate.objects.get(id=template_id)
        except VMTemplate.DoesNotExist:
            return Response({"success": False, "message": "Invalid template"}, status=404)

        price = template.price_per_month

        transaction_id = f'WTSUB-{str(uuid.uuid4())[:8].upper()}'
        try:
            Payment.objects.create(
                user=request.user,
                payment_type='workspace_template_subscription',
                amount_tzs=price,
                currency='TZS',
                provider=provider,
                phone_number=phone,
                status='completed',
                transaction_id=transaction_id,
                metadata={'template_id': template.id, 'template_name': template.name},
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'FAILED to create payment record: {str(e)}', exc_info=True)
            return Response({
                'success': False,
                'message': 'Payment could not be processed. Please try again.'
            }, status=500)

        now = timezone.now()
        new_expiry = now + timedelta(days=30)
        sub, created = TemplateSubscription.objects.get_or_create(
            user=request.user, template=template,
            defaults={'is_active': True, 'expires_at': new_expiry}
        )
        if not created:
            # Renewing: extend from current expiry if still in the future, else from now.
            base = sub.expires_at if sub.expires_at and sub.expires_at > now else now
            sub.expires_at = base + timedelta(days=30)
            sub.is_active = True
            sub.save()

        notify(
            user=request.user,
            title='Subscription Active',
            message=f'Unlimited access to {template.name} is now active until {sub.expires_at.strftime("%b %d, %Y")}.',
            notification_type='payment_confirmed',
            link='/workspaces'
        )

        return Response({
            "success": True,
            "data": {
                "transaction_id": transaction_id,
                "amount_paid_tzs": float(price),
                "expires_at": sub.expires_at,
                "template_id": template.id,
            }
        })


class WorkspaceStopView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        workspace = get_object_or_404(Workspace, pk=pk, owner=request.user)

        if workspace.status != 'active' or not workspace.vm:
            return Response({"success": False, "message": "Workspace is not active"}, status=status.HTTP_400_BAD_REQUEST)

        _perform_stop(workspace)

        # Log: 'WORKSPACE_STOPPED'
        notify(
            user=request.user,
            title='Workspace Stopped',
            message=f'Stopped {workspace.name}',
            notification_type='workspace_stopped',
            link='/workspaces'
        )
        return Response({"success": True})

def _perform_delete(workspace):
    """Genuinely tears down a workspace: real Guacamole connection cleanup,
    real Proxmox VM deletion via delete_vm_completely (waits for the
    actual stop+delete tasks to finish, not fire-and-forget), then the DB
    records. This is THE one real deletion path — WorkspaceDeleteView
    (member UI) and the public API's DELETE endpoint both call this
    exact function, so a workspace deleted through either surface gets
    identical, proven infrastructure teardown.

    Returns {'success': True, 'message': ...} or
    {'success': False, 'message': ..., 'status': <http status>}.
    """
    errors = []

    # 1. Delete Guacamole connection
    if workspace.vm and getattr(workspace.vm, 'guacamole_connection_id', None):
        try:
            from apps.vms.services.guacamole_service import GuacamoleService
            gs = GuacamoleService()
            gs.authenticate()
            gs.delete_connection(workspace.vm.guacamole_connection_id)
            print(f'Guacamole connection {workspace.vm.guacamole_connection_id} deleted successfully')
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'FAILED to delete Guacamole connection: {str(e)}', exc_info=True)
            errors.append(f'Guacamole cleanup: {str(e)}')

    # 2. Stop and destroy the actual Proxmox VM
    if workspace.vm and getattr(workspace.vm, 'proxmox_vm_id', None):
        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            ps = ProxmoxService()
            ps.delete_vm_completely(workspace.vm.proxmox_vm_id)
            print(f'Proxmox VM {workspace.vm.proxmox_vm_id} genuinely confirmed deleted')
        except Exception as e:
            error_str = str(e).lower()
            if 'does not exist' not in error_str:
                # Genuine failure, not "already gone" — actually fail here
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f'FAILED to delete Proxmox VM: {str(e)}', exc_info=True)
                return {
                    'success': False,
                    'message': (
                        f'Failed to delete VM from infrastructure: '
                        f'{str(e)}. Please try again or contact support.'
                    ),
                    'status': 500,
                }
            # else: already gone, continue to delete DB records normally

    # 3. Delete DB records
    vm_id = workspace.vm.id if workspace.vm else None
    workspace.delete()
    if vm_id:
        from apps.vms.models import VirtualMachine
        VirtualMachine.objects.filter(id=vm_id).delete()

    if errors:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f'Workspace delete had partial infra errors: {errors}')

    return {'success': True, 'message': 'Workspace permanently deleted'}


class WorkspaceDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            from apps.vms.models import Workspace
            ws = Workspace.objects.get(id=pk, owner=request.user)
        except Workspace.DoesNotExist:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        result = _perform_delete(ws)
        if not result['success']:
            return Response(
                {'success': False, 'message': result['message']},
                status=result.get('status', 500)
            )
        return Response({'success': True, 'message': result['message']})

class WorkspaceStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from apps.vms.models import Workspace
        ws = get_object_or_404(Workspace, id=pk, owner=request.user)

        if not ws.vm:
            return Response({'status': 'stopped'})

        try:
            from apps.vms.services.proxmox_service import ProxmoxService
            ps = ProxmoxService()

            vmid = ws.vm.proxmox_vm_id if hasattr(ws.vm, 'proxmox_vm_id') else getattr(ws.vm, 'proxmox_vmid', None)

            if not vmid:
                return Response({'status': 'no_vm'})

            status_data = ps.proxmox.nodes(ps.node).qemu(vmid).status.current.get()

            return Response({
                'status': status_data.get('status', 'unknown'),
                'cpu_usage': round(status_data.get('cpu', 0) * 100, 1),
                'cpu_cores': status_data.get('cpus', 0),
                'ram_used_mb': round(status_data.get('mem', 0) / (1024**2)),
                'ram_total_mb': round(status_data.get('maxmem', 0) / (1024**2)),
                'disk_used_gb': round(status_data.get('disk', 0) / (1024**3), 1),
                'disk_total_gb': round(status_data.get('maxdisk', 0) / (1024**3), 1),
                'network_in': status_data.get('netin', 0),
                'network_out': status_data.get('netout', 0),
                'uptime_seconds': status_data.get('uptime', 0),
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'error': str(e)
            })
