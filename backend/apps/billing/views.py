from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum
from datetime import timedelta

class BillingOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Return billing summary for the authenticated user.

        Computes:
        - total_spent: SUM of ALL completed payments across ALL payment_type
          values and ALL time (session_hosting, session_extend,
          workspace_hours_purchase, workspace_template_subscription). No
          date filter is applied — this is a true all-time total.
        - this_month_spent: same sum but restricted to the current
          calendar month, provided as supplementary context.
        - workspace_balances: per-template hours remaining (only entries
          with a positive balance).
        - workspace_subscriptions: per-template active subscriptions.
        """
        user = request.user

        now = timezone.now()
        month_start = now.replace(
            day=1, hour=0, minute=0,
            second=0, microsecond=0
        )

        # ── All-time total (ALL payment types, ALL dates) ─────────────────
        # This is what "Total Spent" should represent: every real charge
        # the user has ever paid on this platform.
        total_spent = 0
        this_month_spent = 0
        try:
            from apps.users.models import Payment
            completed_payments = Payment.objects.filter(
                user=user,
                status='completed',
            )

            # All-time: no payment_type filter, no date filter
            all_time_total = completed_payments.aggregate(
                total=Sum('amount_tzs')
            )['total']
            total_spent = float(all_time_total or 0)

            # This-month: same query but scoped to current calendar month
            month_total = completed_payments.filter(
                created_at__gte=month_start
            ).aggregate(
                total=Sum('amount_tzs')
            )['total']
            this_month_spent = float(month_total or 0)

        except Exception:
            pass

        # ── Per-template hours balances (only positive ones) ──────────────
        from apps.vms.models import WorkspaceHoursBalance, TemplateSubscription
        workspace_balances = [
            {
                'template_id': b.template_id,
                'template_name': b.template.name,
                'hours_remaining': float(b.hours_remaining),
            }
            for b in WorkspaceHoursBalance.objects.filter(user=user, hours_remaining__gt=0).select_related('template')
        ]

        # ── Per-template active subscriptions ──────────────────────────────
        workspace_subscriptions = [
            {
                'template_id': s.template_id,
                'template_name': s.template.name,
                'expires_at': s.expires_at,
            }
            for s in TemplateSubscription.objects.filter(
                user=user, is_active=True, expires_at__gt=now
            ).select_related('template')
        ]

        return Response({
            'currency': 'TZS',
            'this_month': {
                # Kept for backward compat — now correctly all-time
                'total_spent': total_spent,
                # Bonus field: actual this-month spending
                'this_month_spent': this_month_spent,
            },
            'workspace_balances': workspace_balances,
            'workspace_subscriptions': workspace_subscriptions,
        })


class UsageHistoryView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        from apps.vms.models import Workspace, VirtualMachine
        
        # Get all user's workspaces with VM details
        workspaces = Workspace.objects.filter(
            owner=user
        ).select_related(
            'vm_template', 'vm'
        ).order_by('-created_at')
        
        items = []
        for ws in workspaces:
            template_name = ''
            if ws.vm_template:
                template_name = ws.vm_template.name
            
            # Calculate duration
            duration = 0
            started = None
            ended = None
            
            if ws.vm:
                started = getattr(ws.vm, 'started_at', None) or getattr(ws.vm, 'allocated_at', None)
                ended = getattr(ws.vm, 'stopped_at', None)
                
                if started and ended:
                    delta = ended - started
                    duration = round(delta.total_seconds() / 3600, 1)
                elif started:
                    delta = timezone.now() - started
                    duration = round(delta.total_seconds() / 3600, 1)
            
            # Calculate charge
            price_per_hour = 0
            if ws.vm_template:
                price_per_hour = float(getattr(ws.vm_template, 'price_per_hour', 0) or 0)
            
            charge = round(duration * price_per_hour)
            
            items.append({
                'id': ws.id,
                'date': (started.strftime('%Y-%m-%d') if started else ws.created_at.strftime('%Y-%m-%d')),
                'time_range': (
                    f"{started.strftime('%H:%M')} - {ended.strftime('%H:%M') if ended else 'Active'}"
                    if started else '—'),
                'template': template_name,
                'template_specs': (
                    f"{ws.vm_template.cpu_cores} vCPU · {ws.vm_template.ram_gb}GB RAM"
                    if ws.vm_template else ''),
                'duration_hours': duration,
                'price_per_hour': price_per_hour,
                'charge': charge,
                'status': ws.status,
            })
        
        return Response({
            'items': items,
            'currency': 'TZS',
        })


class PaymentHistoryView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        try:
            from apps.users.models import Payment
            payments = Payment.objects.filter(
                user=user
            ).order_by('-created_at')
            
            items = []
            for p in payments:
                items.append({
                    'id': p.id,
                    'date': p.created_at.strftime('%Y-%m-%d'),
                    'time': p.created_at.strftime('%H:%M'),
                    'amount': float(p.amount_tzs or 0),
                    'method': getattr(p, 'provider', getattr(p, 'payment_method', 'M-Pesa')),
                    'reference': getattr(p, 'transaction_id', getattr(p, 'reference', f'TXN-{p.id}')),
                    'description': p.get_payment_type_display() if p.payment_type else 'Payment',
                    'status': p.status,
                })
            
            return Response({
                'payments': items,
                'currency': 'TZS',
            })
        except Exception as e:
            return Response({
                'payments': [],
                'currency': 'TZS',
                'error': str(e),
            })


class ReceiptDownloadView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, payment_id):
        # Find Payment model dynamically
        Payment = None
        import django.apps
        for model in django.apps.apps\
            .get_models():
            if 'payment' in \
                model.__name__.lower():
                Payment = model
                break
        
        if not Payment:
            return Response(
                {'error': 'Payment model not found'}, status=500)
        
        try:
            payment = Payment.objects.get(
                id=payment_id,
                user=request.user)
        except Payment.DoesNotExist:
            return Response(
                {'error': 'Not found'},
                status=404)
        
        user = request.user
        
        amount = float(
            getattr(payment, 'amount_tzs',
                getattr(payment, 'amount',
                    0)) or 0)
        
        desc = str(
            getattr(payment, 'description',
                '') or '')
        if not desc:
            try:
                plan = getattr(payment, 
                    'plan', None)
                if plan:
                    desc = getattr(plan, 
                        'name', 
                        'Ospace Service')
                else:
                    desc = 'Ospace Service'
            except:
                desc = 'Ospace Service'
        
        method = str(
            getattr(payment, 'provider',
                getattr(payment, 
                    'payment_method',
                    getattr(payment,
                        'account_number',
                        'Mobile Money'))) 
            or 'Mobile Money')
        
        ref = str(
            getattr(payment, 
                'transaction_id',
                getattr(payment, 
                    'external_id',
                    getattr(payment,
                        'reference',
                        f'TXN-{payment.id:06d}')))
            or f'TXN-{payment.id:06d}')
        
        status = str(
            getattr(payment, 'status',
                'completed'))
        
        return Response({
            'receipt': {
                'id': payment.id,
                'receipt_number': 
                    f'RCP-{payment.id:06d}',
                'date': payment.created_at\
                    .strftime('%B %d, %Y'),
                'time': payment.created_at\
                    .strftime('%H:%M'),
                'customer_name': 
                    f'{user.first_name} '
                    f'{user.last_name}',
                'customer_email': user.email,
                'description': desc,
                'amount': amount,
                'currency': 'TZS',
                'method': method,
                'reference': ref,
                'status': status,
            }
        })
