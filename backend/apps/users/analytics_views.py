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

        return Response({
            "success": True,
            "data": {
                "by_template": by_template,
                "top_users": [
                    {"name": "John Doe", "email": "john@example.com", "vm_count": 12, "total_session_hours": 45},
                    {"name": "Jane Smith", "email": "jane@example.com", "vm_count": 8, "total_session_hours": 32},
                    {"name": "Mike Ross", "email": "mike@example.com", "vm_count": 5, "total_session_hours": 20},
                ]
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
