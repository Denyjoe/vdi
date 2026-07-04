from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from apps.users.permissions import IsAdmin
from apps.sessions.models import RemoteSession

class AdminSessionStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    def get(self, request):
        total_sessions = RemoteSession.objects.count()
        live_sessions = RemoteSession.objects.filter(status='active').count()
        completed_sessions = RemoteSession.objects.filter(status='completed').count()
        
        return Response({
            "success": True,
            "data": {
                "total_sessions": total_sessions,
                "live_sessions": live_sessions,
                "completed_sessions": completed_sessions
            }
        })
