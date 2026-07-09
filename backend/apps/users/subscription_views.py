from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from apps.users.models import SubscriptionPlan, UserSubscription
from apps.users.serializers import SubscriptionPlanSerializer, UserSubscriptionSerializer
from apps.users.permissions import IsAdmin

class SubscriptionPlansView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        plans = SubscriptionPlan.objects.filter(is_active=True).order_by('price_usd')
        serializer = SubscriptionPlanSerializer(plans, many=True)
        return Response({
            "success": True,
            "data": serializer.data
        })

class UserSubscriptionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            sub = request.user.subscription
            serializer = UserSubscriptionSerializer(sub)
            
            plan_hours = sub.plan.compute_hours_per_month
            hours_used = sub.compute_hours_used
            
            if plan_hours == -1:
                hours_remaining = "Unlimited"
                hours_total = "Unlimited"
                percentage_used = 0
            else:
                hours_remaining = max(0, plan_hours - hours_used)
                hours_total = plan_hours
                percentage_used = round((hours_used / plan_hours) * 100, 1) if plan_hours > 0 else 0

            # Calculate next reset (first day of next month)
            today = timezone.now()
            next_reset = (today + relativedelta(months=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            return Response({
                "success": True,
                "data": {
                    "plan": serializer.data,
                    "hours_used": round(hours_used, 2),
                    "hours_remaining": round(hours_remaining, 2) if isinstance(hours_remaining, (int, float)) else hours_remaining,
                    "hours_total": hours_total,
                    "percentage_used": percentage_used,
                    "status": sub.status,
                    "expires_at": sub.expires_at,
                    "can_upgrade": sub.plan.name != 'institution',
                    "next_reset": next_reset
                }
            })
        except UserSubscription.DoesNotExist:
            return Response({
                "success": False,
                "message": "Subscription not found"
            }, status=status.HTTP_404_NOT_FOUND)

class UpgradeSubscriptionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        plan_name = request.data.get('plan_name')
        try:
            plan = SubscriptionPlan.objects.get(name=plan_name, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response({
                "success": False,
                "message": "Invalid plan selected"
            }, status=status.HTTP_400_BAD_REQUEST)
            
        sub, _ = UserSubscription.objects.get_or_create(user=request.user, defaults={'plan': plan})
        if sub.plan != plan:
            sub.plan = plan
            sub.save()
            # Log action (simulate for now)
            # Log: 'SUBSCRIPTION_UPGRADED'
            
        serializer = UserSubscriptionSerializer(sub)
        return Response({
            "success": True,
            "data": serializer.data
        })

class SubscriptionPlanUpdateView(APIView):
    """
    PUT /api/subscriptions/plans/<id>/
    Admin only — update plan pricing and limits.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def put(self, request, plan_id):
        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=404)
        
        if 'name' in request.data:
            plan.name = request.data['name']
        if 'price_usd' in request.data:
            if hasattr(plan, 'price'):
                plan.price = request.data['price_usd']
        if 'price_tzs' in request.data:
            if hasattr(plan, 'price_tzs'):
                plan.price_tzs = request.data['price_tzs']
        if 'max_hours' in request.data:
            if hasattr(plan, 'max_hours'):
                plan.max_hours = request.data['max_hours']
            elif hasattr(plan, 'compute_hours_per_month'):
                plan.compute_hours_per_month = request.data['max_hours']
        if 'max_participants' in request.data:
            if hasattr(plan, 'max_session_participants'):
                plan.max_session_participants = request.data['max_participants']
        if 'can_host' in request.data:
            if hasattr(plan, 'can_host_sessions'):
                plan.can_host_sessions = request.data['can_host']
        
        plan.save()
        
        from apps.users.admin_services import log_admin_action
        log_admin_action(request.user, 'price_changed', f'Updated plan "{plan.name}" pricing/limits', 'plan', plan.id)
        
        return Response({
            'success': True,
            'message': f'Plan "{plan.name}" updated successfully'
        })
