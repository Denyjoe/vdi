from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdmin
from django.utils import timezone
from datetime import timedelta
from apps.users.models import User
from apps.sessions.models import RemoteSession
from apps.vms.models import VMTemplate

class AnalyticsOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    def get(self, request):
        total_users = User.objects.count()
        total_sessions = RemoteSession.objects.count()
        active_sessions = RemoteSession.objects.filter(status='active').count()
        today = timezone.now().date()
        sessions_today = RemoteSession.objects.filter(started_at__date=today).count()
        
        return Response({
            "success": True,
            "data": {
                "users": {"total": total_users},
                "vms": {"total": 12}, # mock
                "sessions": {
                    "total": total_sessions,
                    "active": active_sessions,
                    "today": sessions_today,
                    "avg_duration_minutes": 45
                },
                "assignments": {
                    "total": 24,
                    "submission_rate": 85
                }
            }
        })

class AnalyticsSessionTrendsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    def get(self, request):
        return Response({
            "success": True,
            "data": [
                {"day": "Mon", "sessions": 12, "unique_users": 10},
                {"day": "Tue", "sessions": 19, "unique_users": 15},
                {"day": "Wed", "sessions": 15, "unique_users": 12},
                {"day": "Thu", "sessions": 25, "unique_users": 20},
                {"day": "Fri", "sessions": 32, "unique_users": 25},
                {"day": "Sat", "sessions": 14, "unique_users": 12},
                {"day": "Sun", "sessions": 8, "unique_users": 6},
            ]
        })

class AnalyticsVMUsageView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    def get(self, request):
        from apps.vms.models import VirtualMachine
        from django.db.models import Count

        results = VirtualMachine.objects.exclude(template__isnull=True).values(
            'template__name'
        ).annotate(vm_count=Count('id')).order_by('-vm_count')

        by_template = [
            {"template_name": r['template__name'], "vm_count": r['vm_count']}
            for r in results
        ]

        # Real per-user usage, ranked by workspace count.
        top_users_qs = User.objects.annotate(
            vm_count=Count('virtual_machines', distinct=True)
        ).filter(vm_count__gt=0).order_by('-vm_count')[:5]

        top_users = []
        for u in top_users_qs:
            hours = 0.0
            try:
                from apps.users.models import ComputeUsageLog
                from django.db.models import Sum
                h = ComputeUsageLog.objects.filter(user=u).aggregate(total=Sum('hours_used'))['total']
                hours = float(h or 0)
            except Exception:
                pass
            top_users.append({
                "name": f"{u.first_name} {u.last_name}".strip() or u.email,
                "email": u.email,
                "vm_count": u.vm_count,
                "total_session_hours": round(hours, 1),
            })

        return Response({
            "success": True,
            "data": {
                "by_template": by_template,
                "top_users": top_users,
            }
        })

class AnalyticsActivityView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    def get(self, request):
        return Response({
            "success": True,
            "data": {
                "actions_breakdown": [
                    {"action": "VM_REQUESTED", "count": 150},
                    {"action": "SESSION_CONNECTED", "count": 120},
                    {"action": "FILE_UPLOADED", "count": 85},
                    {"action": "ASSIGNMENT_SUBMITTED", "count": 45},
                ],
                "peak_hours": [
                    {"label": "08:00", "sessions": 10},
                    {"label": "10:00", "sessions": 45},
                    {"label": "12:00", "sessions": 30},
                    {"label": "14:00", "sessions": 50},
                    {"label": "16:00", "sessions": 25},
                    {"label": "18:00", "sessions": 15},
                ]
            }
        })

class AnalyticsAssignmentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    def get(self, request):
        return Response({
            "success": True,
            "data": {
                "assignments_by_class": [
                    {
                        "class_name": "Python 101",
                        "total_assignments": 5,
                        "total_submissions": 120,
                        "late_submissions": 15,
                        "submission_rate": 92
                    },
                    {
                        "class_name": "Data Science",
                        "total_assignments": 3,
                        "total_submissions": 45,
                        "late_submissions": 5,
                        "submission_rate": 75
                    }
                ],
                "recent_submissions": [
                    {"id": 1, "student_name": "Alice Johnson", "assignment_title": "Project 1", "submitted_at": timezone.now().isoformat(), "is_late": False},
                    {"id": 2, "student_name": "Bob Smith", "assignment_title": "Project 1", "submitted_at": (timezone.now() - timedelta(hours=2)).isoformat(), "is_late": True},
                ]
            }
        })

class SessionsDailyView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Count
        from django.db.models.functions import TruncDate
        
        try:
            from apps.sessions.models import LiveSession
            
            week_ago = timezone.now() - timedelta(days=7)
            
            daily = LiveSession.objects.filter(created_at__gte=week_ago).annotate(day=TruncDate('created_at')).values('day').annotate(count=Count('id')).order_by('day')
            
            result = []
            for i in range(7):
                day = (timezone.now() - timedelta(days=6-i)).date()
                found = next((d for d in daily if d['day'] == day), None)
                result.append({
                    'date': day.isoformat(),
                    'day_label': day.strftime('%a'),
                    'count': found['count'] if found else 0,
                })
            
            return Response({'sessions': result})
        except Exception as e:
            return Response({'sessions': [], 'error': str(e)})

class RevenueMonthlyView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Sum
        from django.db.models.functions import TruncMonth, TruncDate
        import calendar
        
        time_range = request.GET.get('range', '6m')
        
        try:
            from apps.users.models import Payment
            
            now = timezone.now()
            result = []
            
            if time_range == '1d':
                from django.db.models.functions import TruncHour
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
                hourly = Payment.objects.filter(status='completed', created_at__gte=start_date).annotate(hour=TruncHour('created_at')).values('hour').annotate(total=Sum('amount_tzs')).order_by('hour')
                for i in range(24):
                    target_hour = start_date + timedelta(hours=i)
                    found = next((h for h in hourly if h['hour'].hour == target_hour.hour), None)
                    result.append({
                        'month': target_hour.strftime('%H:00'),
                        'revenue': float(found['total']) if found else 0,
                    })
            elif time_range == '7d':
                start_date = now - timedelta(days=7)
                daily = Payment.objects.filter(status='completed', created_at__gte=start_date).annotate(date=TruncDate('created_at')).values('date').annotate(total=Sum('amount_tzs')).order_by('date')
                for i in range(6, -1, -1):
                    target_date = (now - timedelta(days=i)).date()
                    found = next((d for d in daily if d['date'] == target_date), None)
                    result.append({
                        'month': target_date.strftime('%a'), # Use short day name for x-axis
                        'revenue': float(found['total']) if found else 0,
                    })
            elif time_range == '30d':
                start_date = now - timedelta(days=30)
                daily = Payment.objects.filter(status='completed', created_at__gte=start_date).annotate(date=TruncDate('created_at')).values('date').annotate(total=Sum('amount_tzs')).order_by('date')
                # For 30 days, maybe group every 3-4 days or just show all 30 days. Recharts can handle 30 points.
                for i in range(29, -1, -1):
                    target_date = (now - timedelta(days=i)).date()
                    found = next((d for d in daily if d['date'] == target_date), None)
                    result.append({
                        'month': target_date.strftime('%d %b'),
                        'revenue': float(found['total']) if found else 0,
                    })
            elif time_range == '1y':
                start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0)
                monthly = Payment.objects.filter(status='completed', created_at__gte=start_date).annotate(month=TruncMonth('created_at')).values('month').annotate(total=Sum('amount_tzs')).order_by('month')
                for i in range(1, 13):
                    found = next((m for m in monthly if m['month'].month == i and m['month'].year == now.year), None)
                    result.append({
                        'month': calendar.month_abbr[i],
                        'revenue': float(found['total']) if found else 0,
                    })
            else: # default 6m
                six_months_ago = now - timedelta(days=180)
                monthly = Payment.objects.filter(status='completed', created_at__gte=six_months_ago).annotate(month=TruncMonth('created_at')).values('month').annotate(total=Sum('amount_tzs')).order_by('month')
                for i in range(5, -1, -1):
                    target_month = (now.month - i - 1) % 12 + 1
                    target_year = now.year + ((now.month - i - 1) // 12)
                    found = next((m for m in monthly if m['month'].month == target_month and m['month'].year == target_year), None)
                    result.append({
                        'month': calendar.month_abbr[target_month],
                        'revenue': float(found['total']) if found else 0,
                    })
            
            return Response({
                'revenue': result,
                'total_all_time': float(Payment.objects.filter(status='completed').aggregate(t=Sum('amount_tzs'))['t'] or 0)
            })
        except Exception as e:
            return Response({'revenue': [], 'error': str(e)})

class UserGrowthView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from django.utils import timezone
        from django.db.models.functions import TruncMonth
        from django.db.models import Count
        import calendar
        
        try:
            from apps.users.models import User
            
            monthly = User.objects.annotate(month=TruncMonth('date_joined')).values('month').annotate(count=Count('id')).order_by('month')
            
            result = []
            now = timezone.now()
            cumulative = 0
            
            for i in range(5, -1, -1):
                target_month = (now.month - i - 1) % 12 + 1
                target_year = now.year + ((now.month - i - 1) // 12)
                
                found = next((m for m in monthly if m['month'].month == target_month and m['month'].year == target_year), None)
                
                new_users = found['count'] if found else 0
                cumulative += new_users
                
                result.append({
                    'month': calendar.month_abbr[target_month],
                    'new_users': new_users,
                    'total_users': cumulative,
                })
            
            return Response({'growth': result})
        except Exception as e:
            return Response({'growth': [], 'error': str(e)})

class RevenueBreakdownView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        from django.db.models import Sum
        from apps.users.models import Payment

        all_payments = Payment.objects.filter(status='completed')
        total = float(all_payments.aggregate(t=Sum('amount_tzs'))['t'] or 0)

        by_type = {
            row['payment_type']: float(row['total'] or 0)
            for row in all_payments.values('payment_type').annotate(total=Sum('amount_tzs'))
        }

        session_hosting = by_type.get('session_hosting', 0) + by_type.get('session_extend', 0)
        workspace_hours_purchases = by_type.get('workspace_hours_purchase', 0)
        workspace_template_subscriptions = by_type.get('workspace_template_subscription', 0)
        # Payments predating the payment_type field (payment_type is null) or any
        # other unclassified value — surfaced honestly rather than folded silently
        # into one of the three real categories.
        uncategorized = total - session_hosting - workspace_hours_purchases - workspace_template_subscriptions

        breakdown = [
            {'label': 'Session Hosting', 'amount': session_hosting},
            {'label': 'Workspace Hours Purchases', 'amount': workspace_hours_purchases},
            {'label': 'Workspace Template Subscriptions', 'amount': workspace_template_subscriptions},
        ]
        if round(uncategorized, 2) != 0:
            breakdown.append({'label': 'Uncategorized', 'amount': uncategorized})

        return Response({
            'total': total,
            'breakdown': breakdown,
        })


class RevenueByTemplateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        from django.db.models import Sum, Count
        from apps.users.models import Payment

        def by_template(payment_type):
            rows = Payment.objects.filter(
                status='completed',
                payment_type=payment_type,
            ).exclude(metadata__template_id__isnull=True).values(
                'metadata__template_id', 'metadata__template_name'
            ).annotate(
                total_revenue=Sum('amount_tzs'),
                payment_count=Count('id'),
            ).order_by('-total_revenue')
            return {
                r['metadata__template_id']: {
                    'template_name': r['metadata__template_name'] or 'Unknown',
                    'total_revenue': float(r['total_revenue'] or 0),
                    'payment_count': r['payment_count'],
                }
                for r in rows
            }

        hours = by_template('workspace_hours_purchase')
        subs = by_template('workspace_template_subscription')

        template_ids = set(hours.keys()) | set(subs.keys())
        data = []
        for tid in template_ids:
            h = hours.get(tid, {'template_name': subs.get(tid, {}).get('template_name', 'Unknown'), 'total_revenue': 0, 'payment_count': 0})
            s = subs.get(tid, {'template_name': hours.get(tid, {}).get('template_name', 'Unknown'), 'total_revenue': 0, 'payment_count': 0})
            data.append({
                'template_id': tid,
                'template_name': h['template_name'],
                'hours_purchase_revenue': h['total_revenue'],
                'hours_purchase_count': h['payment_count'],
                'subscription_revenue': s['total_revenue'],
                'subscription_count': s['payment_count'],
                'total_revenue': h['total_revenue'] + s['total_revenue'],
            })
        data.sort(key=lambda d: -d['total_revenue'])

        return Response({'success': True, 'data': data})

class PlatformStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta
        
        week_ago = timezone.now() - timedelta(days=7)
        
        from apps.users.models import User, Payment
        from apps.vms.models import VirtualMachine, Workspace
        
        total_users = User.objects.count()
        new_users_week = User.objects.filter(date_joined__gte=week_ago).count()
        
        # In this system, user workspaces are modelled as VirtualMachine instances.
        # We don't exclude 'deleted' here because we want this "Total" to reflect 
        # the all-time historical count to match the Template Popularity chart.
        total_workspaces = VirtualMachine.objects.count()

        try:
            from apps.sessions.models import LiveSession
            total_sessions = LiveSession.objects.count()
            sessions_week = LiveSession.objects.filter(created_at__gte=week_ago).count()
        except Exception:
            total_sessions = 0
            sessions_week = 0
        
        from django.db.models import Sum
        total_revenue = float(Payment.objects.filter(status='completed').aggregate(t=Sum('amount_tzs'))['t'] or 0)
        revenue_week = float(Payment.objects.filter(status='completed', created_at__gte=week_ago).aggregate(t=Sum('amount_tzs'))['t'] or 0)
        
        return Response({
            'success': True,
            'data': {
                'total_users': total_users,
                'new_users_week': new_users_week,
                'total_workspaces': total_workspaces,
                'total_sessions': total_sessions,
                'sessions_week': sessions_week,
                'total_revenue_tzs': total_revenue,
                'revenue_week': revenue_week,
            }
        })

class AdminAnalyticsExportView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        import csv
        from django.http import HttpResponse
        from django.db.models import Count, Sum
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="ospace_analytics_report.csv"'
        
        writer = csv.writer(response)
        
        from apps.users.models import User, Payment
        from apps.vms.models import VirtualMachine, Workspace
        
        writer.writerow(['Ospace Analytics Report'])
        writer.writerow([])
        writer.writerow(['Metric', 'Value'])
        writer.writerow(['Total Users', User.objects.count()])
        writer.writerow(['Total VMs', VirtualMachine.objects.exclude(status='deleted').count()])
        writer.writerow(['Total Workspaces', Workspace.objects.count()])
        
        total_revenue = float(Payment.objects.filter(status='completed').aggregate(t=Sum('amount_tzs'))['t'] or 0)
        writer.writerow(['Total Revenue (TZS)', total_revenue])
        
        writer.writerow([])
        writer.writerow(['Template Launches'])
        writer.writerow(['Template', 'Launch Count'])
        
        template_data = Workspace.objects.exclude(vm_template__isnull=True).values('vm_template__name').annotate(count=Count('id')).order_by('-count')
        
        for t in template_data:
            writer.writerow([t['vm_template__name'], t['count']])
        
        return response
