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
        sessions_today = RemoteSession.objects.filter(created_at__date=today).count()
        
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
        from apps.vms.models import Workspace
        from django.db.models import Count

        results = Workspace.objects.exclude(vm_template__isnull=True).values(
            'vm_template__name'
        ).annotate(vm_count=Count('id')).order_by('-vm_count')

        by_template = [
            {"template_name": r['vm_template__name'], "vm_count": r['vm_count']}
            for r in results
        ]

        # Real per-user usage, ranked by workspace count. This used to be
        # hardcoded "John Doe / Jane Smith / Mike Ross" placeholder data
        # that never reflected anything real — the frontend actually
        # ignored this field entirely and built its own zero-filled table
        # from the first 5 users in /users/admin/list/ instead, which is
        # an equally fake "Top Users" table (real names, hardcoded
        # vms=0/hours=0). Both are fixed here: this now returns the real
        # ranking, and DashboardPage-side consumers should read this field.
        top_users_qs = User.objects.annotate(
            vm_count=Count('workspaces', distinct=True)
        ).filter(vm_count__gt=0).order_by('-vm_count')[:5]

        top_users = []
        for u in top_users_qs:
            hours = 0.0
            try:
                sub = getattr(u, 'subscription', None)
                if sub:
                    hours = float(getattr(sub, 'compute_hours_used', 0) or 0)
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
        from django.db.models.functions import TruncMonth
        import calendar
        
        try:
            from apps.users.models import Payment
            
            six_months_ago = timezone.now() - timedelta(days=180)
            
            monthly = Payment.objects.filter(status='completed', created_at__gte=six_months_ago).annotate(month=TruncMonth('created_at')).values('month').annotate(total=Sum('amount_tzs')).order_by('month')
            
            result = []
            now = timezone.now()
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
        
        try:
            from apps.users.models import Payment
            
            all_payments = Payment.objects.filter(status='completed')
            total = float(all_payments.aggregate(t=Sum('amount_tzs'))['t'] or 0)

            # plan is null for pay-per-hour session charges (hosting/
            # extend) and set for subscription plan purchases — this is
            # the real distinction now that the model has no
            # 'description' field to filter on.
            workspace_revenue = float(all_payments.filter(plan__isnull=True).aggregate(t=Sum('amount_tzs'))['t'] or 0)
            host_plan_revenue = float(all_payments.filter(plan__isnull=False).aggregate(t=Sum('amount_tzs'))['t'] or 0)
            other_revenue = max(0, total - workspace_revenue - host_plan_revenue)
            
            return Response({
                'total': total,
                'breakdown': [
                    {'label': 'Workspace Usage', 'amount': workspace_revenue},
                    {'label': 'Host Subscriptions', 'amount': host_plan_revenue},
                    {'label': 'Other', 'amount': other_revenue},
                ]
            })
        except Exception as e:
            return Response({'total': 0, 'breakdown': [], 'error': str(e)})

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
        
        # Was VirtualMachine.objects.count() with no filter — counted every
        # soft-deleted VM row too (test debris accumulates as
        # status='deleted', never actually removed), so "Total VMs" always
        # included long-gone infrastructure alongside anything genuinely
        # live right now.
        total_vms = VirtualMachine.objects.exclude(status='deleted').count()

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
                'total_vms': total_vms,
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
        response['Content-Disposition'] = 'attachment; filename="clouddesk_analytics_report.csv"'
        
        writer = csv.writer(response)
        
        from apps.users.models import User, Payment
        from apps.vms.models import VirtualMachine, Workspace
        
        writer.writerow(['CloudDesk Analytics Report'])
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
