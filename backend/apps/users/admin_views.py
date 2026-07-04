from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from apps.users.permissions import IsAdmin
from apps.users.models import User
from apps.users.serializers import UserProfileSerializer

class AdminUserListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    def get(self, request):
        users = User.objects.all().order_by('-date_joined')
        return Response({
            "success": True,
            "data": UserProfileSerializer(users, many=True).data
        })

class AdminUserStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    def get(self, request):
        total_users = User.objects.count()
        hosts = User.objects.filter(is_host=True).count()
        admins = User.objects.filter(role='admin').count()
        active_users = User.objects.filter(is_active=True).count()
        
        return Response({
            "success": True,
            "data": {
                "total_users": total_users,
                "hosts": hosts,
                "admins": admins,
                "active_users": active_users
            }
        })

class AdminUserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def patch(self, request, pk):
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({"success": False, "message": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            
        role = request.data.get('role')
        if role in ['admin', 'user']:
            user.role = role
            user.save()
            return Response({"success": True, "data": UserProfileSerializer(user).data})
            
        return Response({"success": False, "message": "Invalid role"}, status=status.HTTP_400_BAD_REQUEST)
