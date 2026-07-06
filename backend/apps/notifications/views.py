from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Notification
from .serializers import NotificationSerializer

class NotificationListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int(request.query_params.get('limit', 20))
        notifications = Notification.objects.filter(user=request.user).order_by('-created_at')[:limit]
        serializer = NotificationSerializer(notifications, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
            "message": "Notifications retrieved successfully"
        }, status=status.HTTP_200_OK)

class MarkReadView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
            notification.is_read = True
            notification.save()
            return Response({
                "success": True,
                "data": NotificationSerializer(notification).data,
                "message": "Notification marked as read"
            }, status=status.HTTP_200_OK)
        except Notification.DoesNotExist:
            return Response({
                "success": False,
                "message": "Notification not found"
            }, status=status.HTTP_404_NOT_FOUND)

class MarkAllReadView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({
            "success": True,
            "data": {},
            "message": "All notifications marked as read"
        }, status=status.HTTP_200_OK)

class UnreadCountView(views.APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({
            "success": True,
            "count": count
        })
