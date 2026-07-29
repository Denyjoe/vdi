from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum
from datetime import timedelta

class BillingOverviewView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        now = timezone.now()
        month_start = now.replace(
            day=1, hour=0, minute=0, 
            second=0, microsecond=0)
        
        # Free hours from system config
        try:
            from apps.users.models import SystemConfig
            free_hours = float(
                SystemConfig.get(
                    'free_hours_per_month', '5'))
        except Exception:
            free_hours = 5.0
        
        # Hours used from subscription
        hours_used = 0.0
        try:
            sub = user.subscription
            hours_used = float(
                getattr(sub, 
                    'compute_hours_used', 0) 
                or 0)
        except Exception:
            pass
        
        free_remaining = max(0, free_hours - hours_used)
        paid_hours = max(0, hours_used - free_hours)
        
        # Spending this month
        total_spent = 0
        try:
            from apps.users.models import Payment
            spent = Payment.objects.filter(
                user=user,
                status='completed',
                created_at__gte=month_start
            ).aggregate(
                total=Sum('amount_tzs')
            )['total']
            total_spent = float(spent or 0)
        except Exception:
            pass
        
        # Host plan info
        host_plan = None
        if getattr(user, 'is_host', False):
            try:
                sub = user.subscription
                if sub and sub.plan:
                    plan_name = getattr(
                        sub.plan, 'display_name',
                        getattr(sub.plan, 'name', 
                            ''))
                    
                    # Format raw plan names
                    name_map = {
                        'personal_host': 
                            'Personal Host',
                        'pro_host': 'Pro Host',
                        'institution': 
                            'Institution',
                        'free': 'Free',
                        'none': 'Free',
                    }
                    
                    display_name = name_map.get(
                        plan_name, 
                        plan_name.replace('_', ' ')
                            .title())
                    
                    price = float(
                        getattr(sub.plan, 
                            'price_tzs',
                            getattr(sub.plan, 
                                'price', 0))
                        or 0)
                    
                    host_plan = {
                        'name': display_name,
                        'price': price,
                    }
            except Exception:
                pass
        
        return Response({
            'currency': 'TZS',
            'this_month': {
                'total_spent': total_spent,
                'hours_used': round(hours_used, 1),
                'free_hours_total': free_hours,
                'free_hours_remaining': round(free_remaining, 1),
                'paid_hours': round(paid_hours, 1),
            },
            'host_plan': host_plan,
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
                    'description': f"Plan: {p.plan.name}" if hasattr(p, 'plan') and p.plan else 'Workspace usage',
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
                        'CloudDesk Service')
                else:
                    desc = 'CloudDesk Service'
            except:
                desc = 'CloudDesk Service'
        
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

class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        from apps.users.models import (
            SubscriptionPlan, 
            UserSubscription, 
            Payment)
        
        plan_name = request.data.get('plan_name')
        phone = request.data.get('phone_number')
        provider = request.data.get('provider')
        
        # In DB the names are like 'pro_host', 'personal_host', 'starter', 'free'
        db_plan_name = plan_name.lower().replace(' ', '_')
        if db_plan_name == 'starter': db_plan_name = 'personal_host'
        if db_plan_name == 'pro': db_plan_name = 'pro_host'
        
        try:
            plan = SubscriptionPlan.objects.get(name=db_plan_name)
        except SubscriptionPlan.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Plan not found'
            }, status=404)
        
        # SANDBOX MODE — simulate instant payment success
        import uuid
        transaction_id = f'CD-{str(uuid.uuid4())[:8].upper()}'

        try:
            payment = Payment.objects.create(
                user=request.user,
                plan=plan,
                amount_tzs=plan.price_tzs,
                amount_usd=plan.price_usd,
                currency='TZS',
                provider=provider,
                phone_number=phone,
                status='completed',
                transaction_id=transaction_id,
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'FAILED to create payment record: {str(e)}', exc_info=True)
            # Financial record — don't grant the subscription if we can't
            # prove the payment was ever actually saved.
            return Response({
                'success': False,
                'message': 'Payment could not be processed. Please try again.'
            }, status=500)

        # Activate subscription immediately
        existing = UserSubscription.objects.filter(user=request.user).first()
        
        if existing:
            existing.plan = plan
            existing.status = 'active'
            existing.save()
        else:
            UserSubscription.objects.create(
                user=request.user,
                plan=plan,
                status='active')
        
        # Also flip is_host=True
        request.user.is_host = True
        request.user.save(update_fields=['is_host'])
        
        from apps.users.admin_services import log_admin_action
        try:
            log_admin_action(
                request.user, 
                'config_changed',
                f'{request.user.email} upgraded to {plan.name} host plan (sandbox)')
        except Exception:
            pass
        
        return Response({
            'success': True,
            'message': f'Successfully upgraded to {plan.display_name or plan.name}'
        })
